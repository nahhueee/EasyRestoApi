import {MiscRepo} from '../data/miscRepository';
import {Router, Request, Response} from 'express';
import logger from '../log/loggerGeneral';
const router : Router  = Router();

//#region OBTENER
router.get('/selector-tpedido', async (req:Request, res:Response) => {
    try{ 
        res.json(await MiscRepo.TiposPedidoSelector());

    } catch(error:any){
        let msg = "Error al obtener el selector de tipos de pedido.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.get('/selector-tpago', async (req:Request, res:Response) => {
    try{ 
        res.json(await MiscRepo.TiposPagoSelector());

    } catch(error:any){
        let msg = "Error al obtener el selector de tipos de pago.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

// Export the router
export default router; 