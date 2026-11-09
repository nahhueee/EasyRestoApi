import { prodRepository } from '../data/productosRepository';
import { UsuariosRepo } from '../data/usuariosRepository';
import { movimientosRepository } from '../data/productosMovimientosRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await prodRepository.Obtener(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de productos.", 500, { modulo: 'productosRoute.obtener' }, error));
    }
});

router.get('/obtener-producto/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await prodRepository.ObtenerProducto({idProducto: req.params.id }));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el producto nro " + req.params.id + ".", 500, { modulo: 'productosRoute.obtener-producto' }, error));
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response, next) => {
    try{
        res.json(await prodRepository.Agregar(req.body, (req as any).contexto));

    } catch(error:any){
        if(error instanceof AppError) return next(error); //validaciones del repository (400)
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar agregar el producto.", 500, { modulo: 'productosRoute.agregar' }, error));
    }
});

router.put('/modificar', async (req:Request, res:Response, next) => {
    try{
        res.json(await prodRepository.Modificar(req.body, (req as any).contexto));

    } catch(error:any){
        if(error instanceof AppError) return next(error); //validaciones del repository (400)
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar modificar el producto.", 500, { modulo: 'productosRoute.modificar' }, error));
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response, next) => {
    try{
        res.json(await prodRepository.Eliminar(req.params.id, (req as any).contexto));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar eliminar el producto.", 500, { modulo: 'productosRoute.eliminar' }, error));
    }
});
//#endregion

//#region AJUSTE MASIVO
router.post('/precios/simular-ajuste', async (req:Request, res:Response, next) => {
    try{
        // Único endpoint del backend con enforcement de permisos server-side
        // hasta la fecha (handoff PR3): el resto de los gates ADMINISTRADOR de
        // la app son solo de front. No reemplaza autenticación real -x-usuario-id
        // no viaja firmado hasta el token de Fase 4 (architecture.md §8.5/§9)-,
        // pero cierra el caso de alguien pegándole directo al endpoint sin pasar
        // por la UI.
        const contexto = (req as any).contexto;
        const esAdministrador = await UsuariosRepo.EsAdministrador(contexto?.idUsuario ?? null);
        if (!esAdministrador) return res.status(403).send("No tiene permisos para realizar esta acción.");

        res.json(await prodRepository.SimularAjusteMasivo(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al simular el ajuste de precios.", 500, { modulo: 'productosRoute.precios-simular-ajuste' }, error));
    }
});

router.post('/precios/ajustar', async (req:Request, res:Response, next) => {
    try{
        const contexto = (req as any).contexto;
        const esAdministrador = await UsuariosRepo.EsAdministrador(contexto?.idUsuario ?? null);
        if (!esAdministrador) return res.status(403).send("No tiene permisos para realizar esta acción.");

        res.json(await prodRepository.AjustarMasivo(req.body, contexto));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al aplicar el ajuste de precios.", 500, { modulo: 'productosRoute.precios-ajustar' }, error));
    }
});

router.post('/precios/deshacer-lote/:loteId', async (req:Request, res:Response, next) => {
    try{
        // Mismo gate que simular-ajuste/ajustar: deshacer un lote es al menos
        // tan sensible como aplicarlo.
        const contexto = (req as any).contexto;
        const esAdministrador = await UsuariosRepo.EsAdministrador(contexto?.idUsuario ?? null);
        if (!esAdministrador) return res.status(403).send("No tiene permisos para realizar esta acción.");

        res.json(await prodRepository.DeshacerLoteAjuste(req.params.loteId, contexto));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al deshacer el lote de ajuste.", 500, { modulo: 'productosRoute.precios-deshacer-lote' }, error));
    }
});
//#endregion

//#region AUDITORÍA (PR6)
router.get('/precios/lotes', async (req:Request, res:Response, next) => {
    try{
        // Mismo gate que el resto de ajuste-masivo: la lista completa de
        // cambios de precio del comercio es al menos tan sensible como
        // aplicarlos o deshacerlos.
        const contexto = (req as any).contexto;
        const esAdministrador = await UsuariosRepo.EsAdministrador(contexto?.idUsuario ?? null);
        if (!esAdministrador) return res.status(403).send("No tiene permisos para realizar esta acción.");

        const filtros = {
            pagina: req.query.pagina != null ? Number(req.query.pagina) : 1,
            tamanioPagina: req.query.tamanioPagina != null ? Number(req.query.tamanioPagina) : undefined,
            idUsuario: req.query.idUsuario != null ? Number(req.query.idUsuario) : null,
            fechaDesde: req.query.fechaDesde ?? null,
            fechaHasta: req.query.fechaHasta ?? null,
            estado: req.query.estado ?? null,
        };

        res.json(await prodRepository.ObtenerLotes(filtros));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de lotes de ajuste.", 500, { modulo: 'productosRoute.precios-lotes' }, error));
    }
});

router.get('/precios/historial/:idPrecio', async (req:Request, res:Response, next) => {
    try{
        // Sin gate de administrador a propósito: es el historial de un solo
        // precio, ya visible para quien tenga abierto ese producto en
        // addmod-productos -no es la vista agregada de todos los lotes.
        res.json(await prodRepository.ObtenerHistorialPrecio(Number(req.params.idPrecio)));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el historial del precio nro " + req.params.idPrecio + ".", 500, { modulo: 'productosRoute.precios-historial' }, error));
    }
});
//#endregion

//#region STOCK
router.post('/:id/ajuste-stock', async (req:Request, res:Response, next) => {
    try{
        // Solo administrador, igual que el ajuste masivo de precios: tocar el stock a
        // mano es tan sensible como tocar los precios. Enforcement server-side.
        const contexto = (req as any).contexto;
        const esAdministrador = await UsuariosRepo.EsAdministrador(contexto?.idUsuario ?? null);
        if (!esAdministrador) return res.status(403).send("No tiene permisos para realizar esta acción.");

        const idProducto = Number(req.params.id);
        if (!Number.isInteger(idProducto)) throw new AppError(CodigoError.VALIDACION, "Producto inválido.", 400);

        res.json(await movimientosRepository.AjustarStock(idProducto, req.body, contexto));

    } catch(error:any){
        if(error instanceof AppError) return next(error);
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al ajustar el stock del producto nro " + req.params.id + ".", 500, { modulo: 'productosRoute.ajuste-stock' }, error));
    }
});

router.get('/:id/movimientos', async (req:Request, res:Response, next) => {
    try{
        const idProducto = Number(req.params.id);
        if (!Number.isInteger(idProducto)) throw new AppError(CodigoError.VALIDACION, "Producto inválido.", 400);

        const limiteCrudo = Number(req.query.limite);
        const limite = Number.isInteger(limiteCrudo) && limiteCrudo > 0 ? Math.min(limiteCrudo, 50) : 4;

        res.json(await movimientosRepository.ObtenerUltimos(idProducto, limite));

    } catch(error:any){
        if(error instanceof AppError) return next(error);
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener los movimientos del producto nro " + req.params.id + ".", 500, { modulo: 'productosRoute.movimientos' }, error));
    }
});
//#endregion

// Export the router
export default router;