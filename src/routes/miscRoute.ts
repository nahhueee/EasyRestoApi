import {MiscRepo} from '../data/miscRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

//#region OBTENER
router.get('/selector-tpedido', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MiscRepo.TiposPedidoSelector());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el selector de tipos de pedido.", 500, { modulo: 'miscRoute.selector-tpedido' }, error));
    }
});

router.get('/selector-tpago', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MiscRepo.TiposPagoSelector());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el selector de tipos de pago.", 500, { modulo: 'miscRoute.selector-tpago' }, error));
    }
});
//#endregion

// Export the router
export default router; 