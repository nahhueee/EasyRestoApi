import { CodigoError } from './CodigosError';

// Exclusivo del flujo HTTP (routes/services detrás de una route). El flujo
// background (crons, servicios) NO instancia AppError: llama a
// logger.error({ code, ... }) directamente. Ver handoff_fase1_adminserver_sonnet.md §6.1.
export class AppError extends Error {
  constructor(
    public readonly code: CodigoError,
    message: string,
    public readonly status?: number,           // opcional: background no tiene HTTP
    public readonly context?: Record<string, unknown>,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
