import winston from 'winston';
import Transport from 'winston-transport';
import * as path from 'path';
import { SEVERIDAD, debeEnviar, CodigoError } from './CodigosError';
const moment = require('moment-timezone');

const timezoned = () => moment().tz('America/Argentina/Buenos_Aires').format('DD-MM-YY HH:mm');

// Winston trata logger.error(obj) como info.message = obj (NO hace spread).
// Sin esto, logger.error({code, message, modulo}) quedaría enterrado en info.message.
// Este format sube los campos al root e inyecta severity desde el código.
const extraerCamposDeMessage = winston.format((info) => {
  const payload: any = info.message;
  if (payload && typeof payload === 'object') {
    const { message: textoInterno, ...resto } = payload;
    Object.assign(info, resto);
    info.message = textoInterno ?? '';
  }
  const code = (info as any).code as CodigoError | undefined;
  if (code && !(info as any).severity) {
    // IGNORAR_REMOTO se muestra como BAJA en el visor; nunca se pone a mano.
    const sev = SEVERIDAD[code] ?? 'IGNORAR_REMOTO';
    (info as any).severity = sev === 'IGNORAR_REMOTO' ? 'BAJA' : sev;
  }
  return info;
});

// Intercepta cada error con code y lo encola en el batch si debeEnviar(code).
// Es el ÚNICO punto de decisión de envío. Aplica a HTTP y a background por igual.
class ErrorBatchTransport extends Transport {
  constructor() {
    super({ level: 'error' });
  }

  log(info: any, callback: () => void): void {
    // Avisamos inmediatamente a Winston -- lo que pase después no debe bloquear ni tirar el request.
    callback();

    if (!info?.code || !debeEnviar(info.code)) {
      return;
    }

    setImmediate(() => {
      try {
        // require lazy para evitar dependencia circular logger <-> errorBatchService
        const { ErrorBatchServ } = require('../services/errorBatchService');
        ErrorBatchServ.registrar(info.code, info.message ?? '');
      } catch {
        // Nunca romper el logger desde acá (ver bug real: encolar() no existía más).
      }
    });
  }
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    extraerCamposDeMessage(),
    winston.format.timestamp({ format: timezoned }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: path.resolve(__dirname, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.resolve(__dirname, 'app.log') }),
    new ErrorBatchTransport(),
    new winston.transports.Console(),
  ],
});

export default logger;
