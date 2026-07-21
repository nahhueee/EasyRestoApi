import { Request, Response, NextFunction } from 'express';
import logger from '../log/logger';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';

// Único punto donde un error HTTP se loguea y se traduce a respuesta.
// NO decide qué se envía a AdminServer (eso lo hace ErrorBatchTransport en
// src/log/logger.ts, según debeEnviar(code)). Acá solo se loguea estructurado
// y se responde {code, message} sanitizado (nunca stack/context/cause al cliente).
export function errorMiddleware(err: any, req: Request, res: Response, _next: NextFunction) {
  const esAppError = err instanceof AppError;
  const status = esAppError ? (err.status ?? 500) : 500;

  logger.error({
    code:    esAppError ? err.code : CodigoError.INTERNAL_ERROR,
    message: err?.message,
    status,
    route:   req.originalUrl,
    method:  req.method,
    context: esAppError ? err.context : undefined,
    cause:   esAppError ? (err.cause as any)?.message : undefined,
    stack:   err?.stack,
  });

  // Al cliente NUNCA se le expone el mensaje real de un error no controlado
  // (podría filtrar detalle interno). Solo un AppError -- error esperado y
  // controlado del dominio -- expone su mensaje tal cual.
  res.status(status).json({
    code:    esAppError ? err.code : CodigoError.INTERNAL_ERROR,
    message: esAppError ? err.message : 'Error interno del servidor',
  });
}
