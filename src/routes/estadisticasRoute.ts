import {EstadisticasRepo} from '../data/estadisticasRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

router.post('/get-generales', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await EstadisticasRepo.TotalesCantGenerales(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener datos de estadistica generales.", 500, { modulo: 'estadisticasRoute.get-generales' }, error));
    }
});

router.post('/get-tipoPago', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await EstadisticasRepo.TotalesXTipoPago(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener datos totales por tipo de pago.", 500, { modulo: 'estadisticasRoute.get-tipoPago' }, error));
    }
});

router.post('/get-tipoPedido', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await EstadisticasRepo.TotalesXTipoPedido(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener datos por tipo de pedido.", 500, { modulo: 'estadisticasRoute.get-tipoPedido' }, error));
    }
});

router.post('/get-populares', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await EstadisticasRepo.ProductosPopulares(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener datos de productos populares.", 500, { modulo: 'estadisticasRoute.get-populares' }, error));
    }
});

router.post('/get-ganancias', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await EstadisticasRepo.GananciasComparativas(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener datos ganancias comparativas.", 500, { modulo: 'estadisticasRoute.get-ganancias' }, error));
    }
});
// Export the router
export default router; 