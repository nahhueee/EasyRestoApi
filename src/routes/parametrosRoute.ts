import {ParametrosRepo} from '../data/parametrosRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();
import config from '../conf/app.config';

router.get('/obtener/:clave', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ParametrosRepo.ObtenerParametros(req.params.clave));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar obtener parametros.", 500, { modulo: 'parametrosRoute.obtener' }, error));
    }
});

router.put('/actualizar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ParametrosRepo.ActualizarParametro(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar guardar un parametro.", 500, { modulo: 'parametrosRoute.actualizar' }, error));
    }
});

router.get('/obtener-facturacion', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ParametrosRepo.ObtenerParametrosFacturacion());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar obtener parametros de facturacion.", 500, { modulo: 'parametrosRoute.obtener-facturacion' }, error));
    }
});

router.get('/obtener-impresion', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ParametrosRepo.ObtenerParametrosImpresion());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar obtener parametros de impresion.", 500, { modulo: 'parametrosRoute.obtener-impresion' }, error));
    }
});

router.get('/obtener-mobile', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ParametrosRepo.ObtenerParametrosMobile());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar obtener parametros para dispositivos moviles.", 500, { modulo: 'parametrosRoute.obtener-mobile' }, error));
    }
});

router.post('/actualizar-mobile', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ParametrosRepo.ActualizarMobile(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar guardar parametros para dispositivos moviles.", 500, { modulo: 'parametrosRoute.actualizar-mobile' }, error));
    }
});

router.post('/actualizar-facturacion', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ParametrosRepo.ActualizarFacturacion(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar guardar parametros de facturación.", 500, { modulo: 'parametrosRoute.actualizar-facturacion' }, error));
    }
});

router.post('/actualizar-impresion', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await ParametrosRepo.ActualizarImpresion(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar guardar parametros de impresion.", 500, { modulo: 'parametrosRoute.actualizar-impresion' }, error));
    }
});

//Modo en red
router.get('/modo-server/', async (req, res) => {
    res.json(config.esServer);
});

router.post('/actualizar-backups', async (req:Request, res:Response, next) => {
    try{ 
        let data = req.body;
        
        if(data){
            let expresion = await GenerarExpresion(data);

            ParametrosRepo.ActualizarParametro({clave:'expresion', valor:expresion})
            ParametrosRepo.ActualizarParametro({clave:'backups', valor:data.activar==1?"true":"false"})
            ParametrosRepo.ActualizarParametro({clave:'dias', valor:data.dias.join(",")})
            ParametrosRepo.ActualizarParametro({clave:'hora', valor:data.hora})
            res.json("OK");

        }else
            throw {message:"No se proporcionó data"};
        

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar guardar los parametros de backup.", 500, { modulo: 'parametrosRoute.actualizar-backups' }, error));
    }
});

async function GenerarExpresion(data:any){
    let expresion:string = "";
    const diasSemana = {
        "Domingo": 0,
        "Lunes": 1,
        "Martes": 2,
        "Miércoles": 3,
        "Jueves": 4,
        "Viernes": 5,
        "Sábado": 6
    };
    
    //Dividimos en horas y minutos
    const [hh, mm] = data.hora.split(":");
    data.hh = hh;
    data.mm = mm;

    //Obtenemos el nro del dia seleccionado por el usurio
    const diasNro = data.dias.map(dia => diasSemana[dia]);

    //Armamos la expresion cron 
    expresion = `${mm} ${hh} * * ${diasNro.join(",")}`;
    
    return expresion;
}


// Export the router
export default router; 