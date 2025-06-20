import {MesasRepo} from '../data/mesasRepository';
import {Router, Request, Response} from 'express';
import logger from '../log/loggerGeneral';
const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response) => {
    try{ 
        res.json(await MesasRepo.Obtener(req.body));

    } catch(error:any){
        let msg = "Error al obtener el listado de mesas.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.get('/selector', async (req:Request, res:Response) => {
    try{ 
        res.json(await MesasRepo.MesasSelector());

    } catch(error:any){
        let msg = "Error al obtener el selector de mesas.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response) => {
    try{ 
        res.json(await MesasRepo.Agregar(req.body));

    } catch(error:any){
        let msg = "Error al intentar agregar la mesa.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.put('/modificar', async (req:Request, res:Response) => {
    try{ 
        res.json(await MesasRepo.Modificar(req.body));

    } catch(error:any){
        let msg = "Error al intentar modificar la mesa.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response) => {
    try{ 
        res.json(await MesasRepo.Eliminar(req.params.id));

    } catch(error:any){
        let msg = "Error al intentar eliminar la mesa.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

// Export the router
export default router; 