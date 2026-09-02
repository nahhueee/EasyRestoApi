import {SalonesRepo} from '../data/salonesRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

//#region OBTENER
router.get('/obtener', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await SalonesRepo.Obtener());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de salones.", 500, { modulo: 'salonesRoute.obtener' }, error));
    }
});
//#endregion

//#region ABM
router.put('/grabar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await SalonesRepo.GrabarSalones(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar guardar salones.", 500, { modulo: 'salonesRoute.grabar' }, error));
    }
});
//#endregion

// Export the router
export default router; 