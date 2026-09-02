import {CajasRepo} from '../data/cajasRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await CajasRepo.Obtener(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de cajas.", 500, { modulo: 'cajasRoute.obtener' }, error));
    }
});

router.get('/obtener-caja/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await CajasRepo.ObtenerCaja({idCaja: req.params.id }));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener la caja nro " + req.params.id + ".", 500, { modulo: 'cajasRoute.obtener-caja' }, error));
    }
});

router.get('/obtener-ultima-activa', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await CajasRepo.ObtenerUltimaCajaActiva());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener la última caja activa.", 500, { modulo: 'cajasRoute.obtener-ultima-activa' }, error));
    }
});
//#endregion

//#region ABM
router.put('/finalizar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await CajasRepo.Finalizar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar actualizar el estado de la caja.", 500, { modulo: 'cajasRoute.finalizar' }, error));
    }
});

router.post('/agregar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await CajasRepo.Agregar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar agregar una nueva caja.", 500, { modulo: 'cajasRoute.agregar' }, error));
    }
});

router.put('/modificar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await CajasRepo.Modificar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar modificar la caja nro " + req.body.id + ".", 500, { modulo: 'cajasRoute.modificar' }, error));
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await CajasRepo.Eliminar(req.params.id));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar eliminar la caja nro " + req.params.id + ".", 500, { modulo: 'cajasRoute.eliminar' }, error));
    }
});
//#endregion

// Export the router
export default router; 