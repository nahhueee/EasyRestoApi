import {ListasRepo} from '../data/listasPrecioRepository';
import {Router, Request, Response} from 'express';
import logger from '../log/loggerGeneral';
const router : Router  = Router();

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response) => {
    try{ 
        res.json(await ListasRepo.Obtener(req.body));

    } catch(error:any){
        let msg = "Error al obtener el listado de listas de precio.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.get('/selector', async (req:Request, res:Response) => {
    try{ 
        res.json(await ListasRepo.ListasSelector());

    } catch(error:any){
        let msg = "Error al obtener el selector de listas de precio.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response) => {
    try{ 
        res.json(await ListasRepo.Agregar(req.body));

    } catch(error:any){
        let msg = "Error al intentar agregar la lista de precios.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.put('/modificar', async (req:Request, res:Response) => {
    try{ 
        res.json(await ListasRepo.Modificar(req.body));

    } catch(error:any){
        let msg = "Error al intentar modificar la lista de precios.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response) => {
    try{ 
        res.json(await ListasRepo.Eliminar(req.params.id));

    } catch(error:any){
        let msg = "Error al intentar eliminar la lista de precios.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

// Export the router
export default router; 