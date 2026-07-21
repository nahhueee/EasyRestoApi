/**
 * SERVICIO DE BATCH DE ERRORES
 * ============================
 * Réplica del estándar de EasySalesApi (documentos/estandar_errores.md).
 * Acumula errores de runtime en disco y los envía en lotes a AdminServer.
 *
 * - Retención local máxima: 5 días (entradas más viejas se descartan)
 * - Cap por código: 500 ocurrencias máximas antes de descartar y registrar OVERFLOW
 * - Backoff exponencial: 15 → 30 → 60 → 120 → 240 min ante fallos consecutivos
 * - Idempotencia: cada envío lleva un batch_id UUID que AdminServer verifica
 *
 * Flujo:
 * 1. ErrorBatchTransport (logger.ts) llama a registrar(codigo, mensaje)
 * 2. Se acumula en src/log/errores-pendientes.json (array)
 * 3. Cada 15 minutos, IniciarCron() evalúa si enviar el batch a AdminServer
 * 4. Si el envío falla, el archivo se preserva y el intervalo se extiende (backoff)
 */

import axios from 'axios';
import config from '../conf/app.config';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import moment from 'moment';
import logger from '../log/logger';
import { CodigoError } from '../log/CodigosError';

const cron = require('node-cron');

const ROOT_DIR = process.cwd();
const ERRORES_PENDIENTES_PATH = path.join(ROOT_DIR, 'src', 'log', 'errores-pendientes.json');

const MAX_ANTIGUEDAD_DIAS = 5;
const MAX_CANTIDAD_POR_CODIGO = 500;

// Índice 0 = sin fallos (operación normal), índice 5+ = cap máximo.
const BACKOFF_MINUTOS = [0, 15, 30, 60, 120, 240];

interface ErrorPendiente {
  codigo: string;
  mensaje: string;
  cantidad: number;
  fechaPrimero: string;
  fechaUltimo: string;
}

class ErrorBatchService {

  private fallosConsecutivos = 0;
  private puedeEnviarDesde: Date = new Date(0);

  IniciarCron(): void {
    cron.schedule('*/15 * * * *', () => this.EnviarBatch());
  }

  /**
   * Registra un error en el buffer local. Único consumidor: ErrorBatchTransport
   * (src/log/logger.ts) cuando debeEnviar(code) es true.
   */
  registrar(codigo: string, mensaje: string): void {
    try {
      const ahora = new Date();
      let errores = this._leerArchivo();
      errores = this._purgarViejos(errores, ahora);

      const existente = errores.find(e => e.codigo === codigo);

      if (existente) {
        if (existente.cantidad >= MAX_CANTIDAD_POR_CODIGO) {
          logger.warn({
            code: CodigoError.ERROR_BATCH_OVERFLOW,
            message: `Cap de ${MAX_CANTIDAD_POR_CODIGO} alcanzado para código: ${codigo}`,
            modulo: 'errorBatchService',
          });
          return;
        }
        existente.cantidad++;
        existente.mensaje = mensaje;
        existente.fechaUltimo = moment(ahora).format('YYYY-MM-DD HH:mm:ss');
      } else {
        errores.push({
          codigo,
          mensaje,
          cantidad: 1,
          fechaPrimero: moment(ahora).format('YYYY-MM-DD HH:mm:ss'),
          fechaUltimo: moment(ahora).format('YYYY-MM-DD HH:mm:ss'),
        });
      }

      fs.writeFileSync(ERRORES_PENDIENTES_PATH, JSON.stringify(errores, null, 2));

    } catch (error: any) {
      // console.error intencional: evitar re-entrada al logger (y al transport)
      console.error('[errorBatchService] Error al registrar en buffer local:', error.message);
    }
  }

  /**
   * Envía todos los errores acumulados a AdminServer en una sola llamada.
   * Backoff exponencial ante fallos consecutivos. Solo limpia el archivo si el envío fue exitoso.
   */
  async EnviarBatch(): Promise<void> {
    if (new Date() < this.puedeEnviarDesde) return;

    try {
      if (!fs.existsSync(ERRORES_PENDIENTES_PATH)) return;

      const errores: ErrorPendiente[] = this._leerArchivo();
      if (!errores || errores.length === 0) return;

      const terminal = ObtenerTerminal();
      if (!terminal) return;

      const batch_id = randomUUID();

      await axios.post(`${config.adminUrl}errores/batch`, {
        terminal,
        idApp: config.idApp,
        batch_id,
        errores,
      }, { timeout: 8000 });

      fs.unlinkSync(ERRORES_PENDIENTES_PATH);
      this.fallosConsecutivos = 0;
      this.puedeEnviarDesde = new Date(0);

    } catch (error: any) {
      this.fallosConsecutivos++;
      const idx = Math.min(this.fallosConsecutivos, BACKOFF_MINUTOS.length - 1);
      const minutos = BACKOFF_MINUTOS[idx];
      this.puedeEnviarDesde = new Date(Date.now() + minutos * 60 * 1000);

      logger.error({
        code: CodigoError.ERROR_BATCH_ENVIO_FALLIDO,
        message: error.message || 'Fallo al enviar batch de errores',
        modulo: 'errorBatchService',
        cause: error.cause?.message,
        stack: error.stack,
        fallosConsecutivos: this.fallosConsecutivos,
        proximoIntento: this.puedeEnviarDesde.toISOString(),
      });
    }
  }

  /** Cantidad acumulada desde el último envío exitoso (la usa heartbeatService). */
  cantidadPendiente(): number {
    const errores = this._purgarViejos(this._leerArchivo(), new Date());
    return errores.reduce((total, e) => total + (e.cantidad ?? 1), 0);
  }

  private _leerArchivo(): ErrorPendiente[] {
    if (!fs.existsSync(ERRORES_PENDIENTES_PATH)) return [];
    try {
      const raw: any[] = JSON.parse(fs.readFileSync(ERRORES_PENDIENTES_PATH, 'utf-8'));
      const ahora = new Date().toISOString();
      return raw.map(e => ({
        codigo: e.codigo ?? '',
        mensaje: e.mensaje ?? '',
        cantidad: e.cantidad ?? 1,
        fechaPrimero: e.fechaPrimero ?? ahora,
        fechaUltimo: e.fechaUltimo ?? ahora,
      }));
    } catch {
      return [];
    }
  }

  private _purgarViejos(errores: ErrorPendiente[], ahora: Date): ErrorPendiente[] {
    const limite = new Date(ahora);
    limite.setDate(limite.getDate() - MAX_ANTIGUEDAD_DIAS);
    return errores.filter(e => new Date(e.fechaPrimero) >= limite);
  }
}

function ObtenerTerminal(): string | null {
  const TERMINAL_FILE = path.join(ROOT_DIR, 'terminal.json');
  if (!fs.existsSync(TERMINAL_FILE)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(TERMINAL_FILE, 'utf-8'));
    return data.terminal ?? null;
  } catch {
    return null;
  }
}

export const ErrorBatchServ = new ErrorBatchService();
