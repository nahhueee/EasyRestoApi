import { Request, Response, NextFunction } from 'express';

// Hasta que exista el token de Fase 4 (architecture.md §9), quién y desde
// dónde originó cada request viajan como headers explícitos y se propagan
// hasta el repository -nunca se lee "el usuario actual" desde estado global
// (§9.2)-. Si idUsuario no llega, queda en null: nunca se asume un fallback
// tipo "último usuario logueado", eso falsificaría la auditoría con dos
// cajeros en dos puestos (ver handoff_precios_ajuste_masivo_easyresto.md).
export function identidadMiddleware(req: Request, res: Response, next: NextFunction) {
    const idUsuarioHeader = req.headers['x-usuario-id'];
    const puestoHeader = req.headers['x-puesto'];

    const idUsuario = idUsuarioHeader != null ? parseInt(String(idUsuarioHeader), 10) : NaN;

    (req as any).contexto = {
        idUsuario: Number.isFinite(idUsuario) ? idUsuario : null,
        puesto: puestoHeader != null ? String(puestoHeader) : null,
    };

    next();
}
