import {PedidosRepo} from '../data/pedidosRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
import {FacturacionServ} from '../services/facturacionService';

const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.Obtener(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de pedidos.", 500, { modulo: 'pedidosRoute.obtener' }, error));
    }
});
router.get('/obtener-pedido/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.ObtenerPedido({idPedido: req.params.id }));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el pedido nro " + req.params.id + ".", 500, { modulo: 'pedidosRoute.obtener-pedido' }, error));
    }
});
router.get('/obtener-pedidos-mozo/:idMozo/:idCaja', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.ObtenerPedidosMozo(req.params.idMozo, req.params.idCaja));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de pedidos del responsable.", 500, { modulo: 'pedidosRoute.obtener-pedidos-mozo' }, error));
    }
});

router.get('/obtener-pedidos-baja/:idCaja', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.ObtenerPedidosEnBaja(req.params.idCaja));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de pedidos en estado de baja.", 500, { modulo: 'pedidosRoute.obtener-pedidos-baja' }, error));
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.Agregar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar agregar el pedido.", 500, { modulo: 'pedidosRoute.agregar' }, error));
    }
});

router.post('/guardar-factura', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.GuardarFactura(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar guardar los datos de facturacion para el pedido.", 500, { modulo: 'pedidosRoute.guardar-factura' }, error));
    }
});

router.put('/modificar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.Modificar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar modificar el pedido.", 500, { modulo: 'pedidosRoute.modificar' }, error));
    }
});

router.put('/finalizar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.Finalizar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar finalizar o revertir el pedido.", 500, { modulo: 'pedidosRoute.finalizar' }, error));
    }
});

router.put('/actualizar-impreso', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.ActualizarEstadoImpreso(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar actualizar el estado impreso del pedido.", 500, { modulo: 'pedidosRoute.actualizar-impreso' }, error));
    }
});


router.delete('/eliminar/:id/:obs', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await PedidosRepo.Eliminar(req.params.id, req.params.obs));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar dar de baja el pedido.", 500, { modulo: 'pedidosRoute.eliminar' }, error));
    }
});
//#endregion


//#region OTROS
router.get('/obtenerQR/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await FacturacionServ.ObtenerQRFactura(req.params.id));
    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar obtener el qr de la factura.", 500, { modulo: 'pedidosRoute.obtenerQR' }, error));
    }
});

router.post('/facturar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await FacturacionServ.Facturar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar facturar el comprobante.", 500, { modulo: 'pedidosRoute.facturar' }, error));
    }
});
//#endregion
// Export the router
export default router; 