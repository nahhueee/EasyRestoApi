import {RubrosRepo} from '../data/rubrosRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

//#region OBTENER
router.get('/obtener', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await RubrosRepo.Obtener(""));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de rubros.", 500, { modulo: 'categoriasRuta.obtener' }, error));
    }
});
router.get('/obtener/:filtro', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await RubrosRepo.Obtener(req.params.filtro));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de rubros.", 500, { modulo: 'categoriasRuta.obtener' }, error));
    }
});

router.get('/selector', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await RubrosRepo.RubrosSelector());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el selector de rubros.", 500, { modulo: 'categoriasRuta.selector' }, error));
    }
});
//#endregion

//#region ABM
router.put('/ordenar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await RubrosRepo.Ordenar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar ordenar las categorias.", 500, { modulo: 'categoriasRuta.ordenar' }, error));
    }
});

router.post('/agregar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await RubrosRepo.Agregar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar agregar el rubro.", 500, { modulo: 'categoriasRuta.agregar' }, error));
    }
});

router.put('/modificar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await RubrosRepo.Modificar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar modificar el rubro.", 500, { modulo: 'categoriasRuta.modificar' }, error));
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await RubrosRepo.Eliminar(req.params.id));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar eliminar el rubro.", 500, { modulo: 'categoriasRuta.eliminar' }, error));
    }
});
//#endregion

// Export the router
export default router; 