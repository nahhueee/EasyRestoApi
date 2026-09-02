import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
import {BackupsServ} from '../services/backupService';
const router : Router  = Router();


router.get('/forzar', async (req:Request, res:Response, next) => {
    try{ 
        BackupsServ.IniciarCron();
        res.json('OK');

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar forzar el inicio de cron.", 500, { modulo: 'backupRoute.forzar' }, error));
    }
});

router.get('/generar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await BackupsServ.GenerarBackupLocal());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar generar un backup local.", 500, { modulo: 'backupRoute.generar' }, error));
    }
});

// Export the router
export default router; 