// Fase 1 - AdminServer: modelo de errores de dos flujos (HTTP + background).
// Fuente de verdad de clasificación de códigos y severidad. Alineado a los
// mismos criterios que EasySales (documentos/estandar_errores.md).

export enum CodigoError {
  // Dominio / HTTP
  VALIDACION                = 'VALIDACION',
  TERMINAL_NO_ENCONTRADA     = 'TERMINAL_NO_ENCONTRADA',
  AUTH_NO_HABILITADO         = 'AUTH_NO_HABILITADO',
  ADMIN_SERVER_ERROR         = 'ADMIN_SERVER_ERROR',
  APPCLIENTE_CREACION_ERROR  = 'APPCLIENTE_CREACION_ERROR',
  UPDATE_CHECK_ERROR         = 'UPDATE_CHECK_ERROR',   // específico EasyResto
  NOT_FOUND                  = 'NOT_FOUND',
  INTERNAL_ERROR             = 'INTERNAL_ERROR',
  // Operacionales / Background
  HEARTBEAT_FALLIDO          = 'HEARTBEAT_FALLIDO',
  BACKUP_GENERACION_ERROR    = 'BACKUP_GENERACION_ERROR',
  BACKUP_UPLOAD_ERROR        = 'BACKUP_UPLOAD_ERROR',
  ERROR_BATCH_ENVIO_FALLIDO  = 'ERROR_BATCH_ENVIO_FALLIDO',
  ERROR_BATCH_OVERFLOW       = 'ERROR_BATCH_OVERFLOW',
  DB_CONNECTION_ERROR        = 'DB_CONNECTION_ERROR',
  CRON_INIT_ERROR            = 'CRON_INIT_ERROR',
  UPDATER_APPLY_ERROR        = 'UPDATER_APPLY_ERROR',
  ROLLBACK_FALLIDO           = 'ROLLBACK_FALLIDO',
}

export type Severidad = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA' | 'IGNORAR_REMOTO';

// Mismos criterios que EasySales. IGNORAR_REMOTO = errores que por diseño no
// pueden llegar a AdminServer (paradoja de conectividad: si no hay internet,
// no tiene sentido intentar reportar "no hay internet").
export const SEVERIDAD: Record<CodigoError, Severidad> = {
  [CodigoError.VALIDACION]:                'BAJA',
  [CodigoError.TERMINAL_NO_ENCONTRADA]:    'BAJA',
  [CodigoError.AUTH_NO_HABILITADO]:        'BAJA',
  [CodigoError.ADMIN_SERVER_ERROR]:        'MEDIA',
  [CodigoError.APPCLIENTE_CREACION_ERROR]: 'MEDIA',
  [CodigoError.UPDATE_CHECK_ERROR]:        'BAJA',
  [CodigoError.NOT_FOUND]:                 'BAJA',
  [CodigoError.INTERNAL_ERROR]:            'ALTA',
  [CodigoError.HEARTBEAT_FALLIDO]:         'IGNORAR_REMOTO',
  [CodigoError.BACKUP_GENERACION_ERROR]:   'CRITICA',
  [CodigoError.BACKUP_UPLOAD_ERROR]:       'ALTA',
  [CodigoError.ERROR_BATCH_ENVIO_FALLIDO]: 'IGNORAR_REMOTO',
  [CodigoError.ERROR_BATCH_OVERFLOW]:      'IGNORAR_REMOTO',
  [CodigoError.DB_CONNECTION_ERROR]:       'CRITICA',
  [CodigoError.CRON_INIT_ERROR]:           'ALTA',
  [CodigoError.UPDATER_APPLY_ERROR]:       'CRITICA',
  [CodigoError.ROLLBACK_FALLIDO]:          'CRITICA',
};

// Default conservador: código sin severidad -> IGNORAR_REMOTO (no se envía).
export function debeEnviar(code: CodigoError): boolean {
  const orden: Severidad[] = ['IGNORAR_REMOTO', 'BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
  const sev = SEVERIDAD[code] ?? 'IGNORAR_REMOTO';
  return orden.indexOf(sev) >= orden.indexOf('MEDIA'); // umbral: MEDIA y superiores
}
