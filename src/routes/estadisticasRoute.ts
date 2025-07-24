import {EstadisticasRepo} from '../data/estadisticasRepository';
import {Router, Request, Response} from 'express';
import logger from '../log/loggerGeneral';
const router : Router  = Router();

router.post('/get-generales', async (req:Request, res:Response) => {
    try{ 
        res.json(await EstadisticasRepo.TotalesCantGenerales(req.body));

    } catch(error:any){
        let msg = "Error al obtener datos de estadistica generales.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.post('/get-tipoPago', async (req:Request, res:Response) => {
    try{ 
        res.json(await EstadisticasRepo.TotalesXTipoPago(req.body));

    } catch(error:any){
        let msg = "Error al obtener datos totales por tipo de pago.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.post('/get-tipoPedido', async (req:Request, res:Response) => {
    try{ 
        res.json(await EstadisticasRepo.TotalesXTipoPedido(req.body));

    } catch(error:any){
        let msg = "Error al obtener datos por tipo de pedido.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.post('/get-populares', async (req:Request, res:Response) => {
    try{ 
        res.json(await EstadisticasRepo.ProductosPopulares(req.body));

    } catch(error:any){
        let msg = "Error al obtener datos de productos populares.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.post('/get-ganancias', async (req:Request, res:Response) => {
    try{ 
        res.json(await EstadisticasRepo.GananciasComparativas(req.body));

    } catch(error:any){
        let msg = "Error al obtener datos ganancias comparativas.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
// Export the router
export default router; 