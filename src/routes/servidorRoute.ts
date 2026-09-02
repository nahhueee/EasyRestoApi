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

// Activa/desactiva el modo servidor: persiste config.pc.json y reinicia PM2.
// Reemplaza al comando Tauri change_config_reset (ver servidorService.CambiarModoServidor).
router.post('/modo', async (req:Request, res:Response, next) => {
    try{
        const { esServer } = req.body;

        if (typeof esServer !== 'boolean') {
            res.status(400).send("El campo 'esServer' es requerido y debe ser booleano.");
            return;
        }

        await ServidorServ.CambiarModoServidor(esServer);
        res.json("OK");

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar configurar el modo servidor.", 500, { modulo: 'servidorRoute.modo' }, error));
    }
});

// Reinicia PM2 manualmente. Lo usa el flujo de actualización de backend
// (descargar-actualizacion.component.ts -> ReiniciarServidor()) tras aplicar una
// actualización descargada por /forzar-descarga (actualizacionRoute equivalente en index.ts).
// Divergencia consciente de EasySales: EasySales dispara esto con un comando Tauri
// (invoke('restart_pm2_easysales')) desde el front; acá se resuelve por HTTP, en línea
// con la migración de PM2 a servidorService que ya se hizo para /modo (ver comentario ahí).
router.post('/reiniciar', async (req:Request, res:Response, next) => {
    try{
        res.json("OK");
        // Mismo patrón que CambiarModoServidor(): se agenda el restart para que la
        // respuesta OK llegue al front antes de que el proceso se reinicie.
        setTimeout(() => ServidorServ.RestartPm2(), 800);

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar reiniciar el servidor.", 500, { modulo: 'servidorRoute.reiniciar' }, error));
    }
});

// Export the router
export default router; 