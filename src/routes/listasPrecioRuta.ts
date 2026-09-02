import {ListasRepo} from '../data/listasPrecioRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ListasRepo.Obtener(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de listas de precio.", 500, { modulo: 'listasPrecioRuta.obtener' }, error));
    }
});

router.get('/selector', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ListasRepo.ListasSelector());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el selector de listas de precio.", 500, { modulo: 'listasPrecioRuta.selector' }, error));
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ListasRepo.Agregar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar agregar la lista de precios.", 500, { modulo: 'listasPrecioRuta.agregar' }, error));
    }
});

router.put('/modificar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ListasRepo.Modificar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar modificar la lista de precios.", 500, { modulo: 'listasPrecioRuta.modificar' }, error));
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ListasRepo.Eliminar(req.params.id));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar eliminar la lista de precios.", 500, { modulo: 'listasPrecioRuta.eliminar' }, error));
    }
});
//#endregion

// Export the router
export default router; 