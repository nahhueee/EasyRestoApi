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
//#endregion

// Export the router
export default router; 