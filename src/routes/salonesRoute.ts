import {SalonesRepo} from '../data/salonesRepository';
import {Router, Request, Response} from 'express';
import logger from '../log/loggerGeneral';
const router : Router  = Router();

//#region OBTENER
router.get('/obtener', async (req:Request, res:Response) => {
    try{ 
        res.json(await SalonesRepo.Obtener());

    } catch(error:any){
        let msg = "Error al obtener el listado de salones.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

//#region ABM
router.put('/grabar', async (req:Request, res:Response) => {
    try{ 
        res.json(await SalonesRepo.GrabarSalones(req.body));

    } catch(error:any){
        let msg = "Error al intentar guardar salones.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

// Export the router
export default router; 