import {PedidosRepo} from '../data/pedidosRepository';
import {Router, Request, Response} from 'express';
import logger from '../log/loggerGeneral';
import {FacturacionServ} from '../services/facturacionService';

const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response) => {
    try{ 
        res.json(await PedidosRepo.Obtener(req.body));

    } catch(error:any){
        let msg = "Error al obtener el listado de pedidos.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
router.get('/obtener-pedido/:id', async (req:Request, res:Response) => {
    try{ 
        res.json(await PedidosRepo.ObtenerPedido({idPedido: req.params.id }));

    } catch(error:any){
        let msg = "Error al obtener el pedido nro " + req.params.id + ".";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response) => {
    try{ 
        res.json(await PedidosRepo.Agregar(req.body));

    } catch(error:any){
        let msg = "Error al intentar agregar el pedido.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.post('/guardar-factura', async (req:Request, res:Response) => {
    try{ 
        res.json(await PedidosRepo.GuardarFactura(req.body));

    } catch(error:any){
        let msg = "Error al intentar guardar los datos de facturacion para el pedido.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.put('/modificar', async (req:Request, res:Response) => {
    try{ 
        res.json(await PedidosRepo.Modificar(req.body));

    } catch(error:any){
        let msg = "Error al intentar modificar el pedido.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.put('/finalizar', async (req:Request, res:Response) => {
    try{ 
        res.json(await PedidosRepo.Finalizar(req.body));

    } catch(error:any){
        let msg = "Error al intentar finalizar o revertir el pedido.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.put('/actualizar-impreso', async (req:Request, res:Response) => {
    try{ 
        res.json(await PedidosRepo.ActualizarEstadoImpreso(req.body));

    } catch(error:any){
        let msg = "Error al intentar actualizar el estado impreso del pedido.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});


router.delete('/eliminar/:id', async (req:Request, res:Response) => {
    try{ 
        res.json(await PedidosRepo.Eliminar(req.params.id));

    } catch(error:any){
        let msg = "Error al intentar dar de baja el pedido.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion


//#region OTROS
router.get('/obtenerQR/:id', async (req:Request, res:Response) => {
    try{ 
        res.json(await FacturacionServ.ObtenerQRFactura(req.params.id));
    } catch(error:any){
        let msg = "Error al intentar obtener el qr de la factura.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.post('/facturar', async (req:Request, res:Response) => {
    try{ 
        res.json(await FacturacionServ.Facturar(req.body));

    } catch(error:any){
        let msg = "Error al intentar facturar el comprobante.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion
// Export the router
export default router; 