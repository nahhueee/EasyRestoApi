import {AdicionalesRepo} from '../data/adicionalesRepository';
import {Router, Request, Response} from 'express';
import logger from '../log/loggerGeneral';
const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response) => {
    try{ 
        res.json(await AdicionalesRepo.Obtener(req.body));

    } catch(error:any){
        let msg = "Error al obtener el listado de adicionales.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.get('/buscar/:desc', async (req:Request, res:Response) => {
    try{ 
        res.json(await AdicionalesRepo.BuscarAdicionales(req.params.desc));

    } catch(error:any){
        let msg = "Error al buscar adicionales.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response) => {
    try{ 
        res.json(await AdicionalesRepo.Agregar(req.body));

    } catch(error:any){
        let msg = "Error al intentar agregar el adicional.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.put('/modificar', async (req:Request, res:Response) => {
    try{ 
        res.json(await AdicionalesRepo.Modificar(req.body));

    } catch(error:any){
        let msg = "Error al intentar modificar el adicional.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response) => {
    try{ 
        res.json(await AdicionalesRepo.Eliminar(req.params.id));

    } catch(error:any){
        let msg = "Error al intentar eliminar el adicional.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

// Export the router
export default router; 