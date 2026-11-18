import {MesasRepo} from '../data/mesasRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

//#region OBTENER
router.get('/obtener/:id/:usuario', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MesasRepo.Obtener(req.params.id, req.params.usuario));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de mesas.", 500, { modulo: 'mesasRoute.obtener' }, error));
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MesasRepo.Agregar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar agregar la mesa.", 500, { modulo: 'mesasRoute.agregar' }, error));
    }
});

router.put('/modificar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MesasRepo.Modificar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar modificar la mesa.", 500, { modulo: 'mesasRoute.modificar' }, error));
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MesasRepo.Eliminar(req.params.id));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar eliminar la mesa.", 500, { modulo: 'mesasRoute.eliminar' }, error));
    }
});
//#endregion

//#region OPERACIONES (atomicas: no usar mesas/modificar para estos campos)
router.post('/juntar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MesasRepo.Juntar(req.body?.ids));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar juntar las mesas.", 500, { modulo: 'mesasRoute.juntar' }, error));
    }
});

router.post('/separar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MesasRepo.Separar(req.body?.codGrupo));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar separar las mesas.", 500, { modulo: 'mesasRoute.separar' }, error));
    }
});

router.put('/asignar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MesasRepo.Asignar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar asignar las mesas.", 500, { modulo: 'mesasRoute.asignar' }, error));
    }
});

router.post('/agregar-varias', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await MesasRepo.AgregarVarias(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar crear las mesas.", 500, { modulo: 'mesasRoute.agregarVarias' }, error));
    }
});
//#endregion

// Export the router
export default router; 