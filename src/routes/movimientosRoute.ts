import {MovimientosRepo} from '../data/movimientosRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MovimientosRepo.Obtener(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de movimientos.", 500, { modulo: 'movimientosRoute.obtener' }, error));
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MovimientosRepo.Agregar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar agregar el movimiento.", 500, { modulo: 'movimientosRoute.agregar' }, error));
    }
});

router.put('/eliminar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MovimientosRepo.Eliminar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar eliminar el movimiento.", 500, { modulo: 'movimientosRoute.eliminar' }, error));
    }
});

router.put('/anular', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MovimientosRepo.Anular(req.body));

    } catch(error:any){
        if(error instanceof AppError) return next(error); //validaciones del repository (400)
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar anular el movimiento.", 500, { modulo: 'movimientosRoute.anular' }, error));
    }
});
//#endregion

// Export the router
export default router; 