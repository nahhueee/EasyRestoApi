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

// Export the router
export default router; 