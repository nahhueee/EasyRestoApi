import {AdicionalesRepo} from '../data/adicionalesRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await AdicionalesRepo.Obtener(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de adicionales.", 500, { modulo: 'adicionalesRoute.obtener' }, error));
    }
});

router.get('/selector', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await AdicionalesRepo.AdicionalesSelector());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el selector de adicionales.", 500, { modulo: 'adicionalesRoute.selector' }, error));
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await AdicionalesRepo.Agregar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar agregar el adicional.", 500, { modulo: 'adicionalesRoute.agregar' }, error));
    }
});

router.put('/modificar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await AdicionalesRepo.Modificar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar modificar el adicional.", 500, { modulo: 'adicionalesRoute.modificar' }, error));
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await AdicionalesRepo.Eliminar(req.params.id));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar eliminar el adicional.", 500, { modulo: 'adicionalesRoute.eliminar' }, error));
    }
});
//#endregion

// Export the router
export default router; 