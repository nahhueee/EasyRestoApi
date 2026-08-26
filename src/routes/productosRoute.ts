import { prodRepository } from '../data/productosRepository';
import { UsuariosRepo } from '../data/usuariosRepository';
import {Router, Request, Response} from 'express';
import logger from '../log/loggerGeneral';
const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response) => {
    try{ 
        res.json(await prodRepository.Obtener(req.body));

    } catch(error:any){
        let msg = "Error al obtener el listado de productos.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.get('/obtener-producto/:id', async (req:Request, res:Response) => {
    try{ 
        res.json(await prodRepository.ObtenerProducto({idProducto: req.params.id }));

    } catch(error:any){
        let msg = "Error al obtener el producto nro " + req.params.id + ".";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response) => {
    try{
        res.json(await prodRepository.Agregar(req.body, (req as any).contexto));

    } catch(error:any){
        let msg = "Error al intentar agregar el producto.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.put('/modificar', async (req:Request, res:Response) => {
    try{
        res.json(await prodRepository.Modificar(req.body, (req as any).contexto));

    } catch(error:any){
        let msg = "Error al intentar modificar el producto.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response) => {
    try{
        res.json(await prodRepository.Eliminar(req.params.id, (req as any).contexto));

    } catch(error:any){
        let msg = "Error al intentar eliminar el producto.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

//#region AJUSTE MASIVO
router.post('/precios/simular-ajuste', async (req:Request, res:Response) => {
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
        let msg = "Error al simular el ajuste de precios.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.post('/precios/ajustar', async (req:Request, res:Response) => {
    try{
        const contexto = (req as any).contexto;
        const esAdministrador = await UsuariosRepo.EsAdministrador(contexto?.idUsuario ?? null);
        if (!esAdministrador) return res.status(403).send("No tiene permisos para realizar esta acción.");

        res.json(await prodRepository.AjustarMasivo(req.body, contexto));

    } catch(error:any){
        let msg = "Error al aplicar el ajuste de precios.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

// Export the router
export default router;