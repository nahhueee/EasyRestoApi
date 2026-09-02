import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
import {ServidorServ} from '../services/servidorService';
import config from '../conf/app.config';


const router : Router  = Router();
router.get('/forzar', async (req:Request, res:Response, next) => {
    try{ 
        ServidorServ.IniciarModoServidor();
        res.json("OK");

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar forzar el inicio del modo servidor.", 500, { modulo: 'servidorRoute.forzar' }, error));
    }
});

router.get('/estado', async (req:Request, res:Response, next) => {
    try{ 
        res.json(config.esServer);

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar obtener el modo de trabajo del servidor.", 500, { modulo: 'servidorRoute.estado' }, error));
    }
});

// Export the router
export default router; 