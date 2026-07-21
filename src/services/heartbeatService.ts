/**
 * SERVICIO DE HEARTBEAT
 * =====================
 * Réplica del estándar de EasySalesApi. Envía un pulso periódico a
 * AdminServer con el estado de esta instalación (solo !config.web).
 *
 * Fallos silenciosos: si AdminServer no está disponible, no se interrumpe
 * la operación de la app (HEARTBEAT_FALLIDO es IGNORAR_REMOTO).
 */

import axios from 'axios';
import path from 'path';
import fs from 'fs';
import config from '../conf/app.config';
import db from '../db/db.config';
import { ErrorBatchServ } from './errorBatchService';
import logger from '../log/logger';
import { CodigoError } from '../log/CodigosError';

const cron = require('node-cron');

const ROOT_DIR = process.cwd();
const UPDATER_DIR = path.join(ROOT_DIR, 'updater');

// Instrucción de rollback de backend pendiente — la leería el updater de
// backend (no existe todavía en EasyResto, ver nota de riesgo en la sesión).
const ROLLBACK_PENDIENTE_PATH = path.join(UPDATER_DIR, 'pendiente-rollback.json');
// Evento de la última actualización/rollback del backend, a enviar por heartbeat.
const EVENTO_ACTUALIZACION_PATH = path.join(UPDATER_DIR, 'evento-actualizacion.json');
// Evento de la última actualización del frontend — escrito por POST /update/evento-front.
const EVENTO_ACTUALIZACION_FRONT_PATH = path.join(UPDATER_DIR, 'evento-actualizacion-front.json');
// Señal de que el front instaló una versión y está pendiente de confirmar boot OK.
const PENDIENTE_CONFIRMAR_FRONT_PATH = path.join(UPDATER_DIR, 'pendiente-confirmar-front.json');
// Instrucción de rollback del frontend — la lee el updater de front en el próximo arranque.
const ROLLBACK_FRONT_PENDIENTE_PATH = path.join(UPDATER_DIR, 'pendiente-rollback-front.json');
// Versión de frontend persistida por el frontend en cada boot exitoso (POST /update/registrar-version-front).
const VERSION_FRONT_PATH = path.join(UPDATER_DIR, 'version-front.json');
// Señal de pausa: si existe, el frontend no debe chequear actualizaciones.
const PAUSADO_PATH = path.join(UPDATER_DIR, 'pausado.json');
// Estado del último intento de backup — lo escribe backupService tras cada ejecución.
const BACKUP_ESTADO_PATH = path.join(ROOT_DIR, 'src', 'log', 'backup-estado.json');
const TERMINAL_FILE = path.join(ROOT_DIR, 'terminal.json');

interface EstadoBackup {
  fecha: string;
  ok: boolean;
}

class HeartbeatService {

  IniciarCron(): void {
    cron.schedule('*/10 * * * *', () => this.Enviar());
  }

  async Enviar(): Promise<void> {
    try {
      const terminal = ObtenerTerminal();
      if (!terminal) return;

      const dbStatus = await VerificarDb();
      const tiempoActivo = Math.floor(process.uptime());
      const erroresRecientes = ErrorBatchServ.cantidadPendiente();

      const eventoActualizacion = LeerJson(EVENTO_ACTUALIZACION_PATH);
      const eventoActualizacionFront = LeerJson(EVENTO_ACTUALIZACION_FRONT_PATH);
      const confirmacionFrontPendiente = fs.existsSync(PENDIENTE_CONFIRMAR_FRONT_PATH);

      const estadoBackup = LeerEstadoBackup();

      const respuesta = await axios.post(`${config.adminUrl}heartbeat`, {
        terminal,
        idApp: config.idApp,
        versionBack: await ObtenerVersionBack(),
        versionFront: LeerVersionFront(),
        dbStatus,
        tiempoActivo,
        erroresRecientes,
        ultimoBackupFecha: estadoBackup?.fecha ?? null,
        ultimoBackupOk: estadoBackup?.ok ?? null,
        terminalesLanActivas: 1, // TODO: reemplazar por conteo real del discovery UDP (Fase 2)
        confirmacionFrontPendiente,
        eventoActualizacion,
        eventoActualizacionFront,
      }, { timeout: 8000 });

      // AdminServer confirmó recepción -> eliminamos los eventos locales.
      if (eventoActualizacion && fs.existsSync(EVENTO_ACTUALIZACION_PATH)) {
        fs.unlinkSync(EVENTO_ACTUALIZACION_PATH);
      }
      if (eventoActualizacionFront && fs.existsSync(EVENTO_ACTUALIZACION_FRONT_PATH)) {
        fs.unlinkSync(EVENTO_ACTUALIZACION_FRONT_PATH);
      }

      // Señal de pausa: si AdminServer la ordena, el front no debe buscar updates.
      const pausado: boolean = respuesta.data?.pausado === true;
      if (pausado) {
        EscribirJson(PAUSADO_PATH, { pausado: true, fecha: new Date().toISOString() });
      } else if (fs.existsSync(PAUSADO_PATH)) {
        fs.unlinkSync(PAUSADO_PATH);
      }

      // Rollback de backend ordenado por AdminServer.
      if (respuesta.data?.rollback === true && !fs.existsSync(ROLLBACK_PENDIENTE_PATH)) {
        EscribirJson(ROLLBACK_PENDIENTE_PATH, { instruccion: 'rollback', fecha: new Date().toISOString() });
        logger.info(`Rollback de backend ordenado por AdminServer. Terminal: ${terminal}.`);
      }

      // Rollback de frontend ordenado por AdminServer.
      const rollbackFront = respuesta.data?.rollbackFront;
      if (rollbackFront?.version && rollbackFront?.zipUrl && !fs.existsSync(ROLLBACK_FRONT_PENDIENTE_PATH)) {
        EscribirJson(ROLLBACK_FRONT_PENDIENTE_PATH, {
          version: rollbackFront.version,
          zipUrl: rollbackFront.zipUrl,
          fecha: new Date().toISOString(),
        });
        logger.info(`Rollback de frontend a v${rollbackFront.version} ordenado por AdminServer.`);
      }

    } catch (error: any) {
      // Flujo background puro, sin AppError. HEARTBEAT_FALLIDO es IGNORAR_REMOTO:
      // se loguea local pero no se reintenta reportar (paradoja de conectividad).
      logger.error({
        code: CodigoError.HEARTBEAT_FALLIDO,
        message: error?.message || 'Heartbeat no pudo contactar AdminServer',
        modulo: 'heartbeatService',
        cause: error?.cause?.message,
        stack: error?.stack,
      });
    }
  }
}

function ObtenerTerminal(): string | null {
  if (!fs.existsSync(TERMINAL_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(TERMINAL_FILE, 'utf-8'));
    return data.terminal ?? null;
  } catch {
    return null;
  }
}

async function ObtenerVersionBack(): Promise<string | null> {
  // NOTA: EasySales usa la versión del package.json (pkg.version); EasyResto
  // la tiene en parametros.version (DB). Se mantiene la fuente ya usada en
  // el resto del sistema en vez de introducir un nuevo mecanismo.
  const { ParametrosRepo } = require('../data/parametrosRepository');
  return ParametrosRepo.ObtenerParametros('version');
}

async function VerificarDb(): Promise<'ok' | 'error'> {
  try {
    const connection = await db.getConnection();
    connection.release();
    return 'ok';
  } catch {
    return 'error';
  }
}

function LeerVersionFront(): string | null {
  try {
    if (!fs.existsSync(VERSION_FRONT_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(VERSION_FRONT_PATH, 'utf-8'));
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

function LeerJson(rutaArchivo: string): object | null {
  try {
    if (!fs.existsSync(rutaArchivo)) return null;
    return JSON.parse(fs.readFileSync(rutaArchivo, 'utf-8'));
  } catch {
    return null;
  }
}

function EscribirJson(rutaArchivo: string, data: object): void {
  try {
    if (!fs.existsSync(UPDATER_DIR)) {
      fs.mkdirSync(UPDATER_DIR, { recursive: true });
    }
    fs.writeFileSync(rutaArchivo, JSON.stringify(data, null, 2));
  } catch (error: any) {
    logger.error({
      code: CodigoError.ROLLBACK_FALLIDO,
      message: `No se pudo escribir ${rutaArchivo}: ${error.message || error}`,
      modulo: 'heartbeatService',
      stack: error?.stack,
    });
  }
}

function LeerEstadoBackup(): EstadoBackup | null {
  try {
    if (!fs.existsSync(BACKUP_ESTADO_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(BACKUP_ESTADO_PATH, 'utf-8'));
    if (typeof data.fecha !== 'string' || typeof data.ok !== 'boolean') return null;
    return data;
  } catch {
    return null;
  }
}

export const HeartbeatServ = new HeartbeatService();
