import {RubrosRepo} from '../data/rubrosRepository';
import {Router, Request, Response} from 'express';
import logger from '../log/loggerGeneral';
const router : Router  = Router();

//#region OBTENER
router.get('/obtener', async (req:Request, res:Response) => {
    try{ 
        res.json(await RubrosRepo.Obtener(""));

    } catch(error:any){
        let msg = "Error al obtener el listado de rubros.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
router.get('/obtener/:filtro', async (req:Request, res:Response) => {
    try{ 
        res.json(await RubrosRepo.Obtener(req.params.filtro));

    } catch(error:any){
        let msg = "Error al obtener el listado de rubros.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.get('/selector', async (req:Request, res:Response) => {
    try{ 
        res.json(await RubrosRepo.RubrosSelector());

    } catch(error:any){
        let msg = "Error al obtener el selector de rubros.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

//#region ABM
router.put('/ordenar', async (req:Request, res:Response) => {
    try{ 
        res.json(await RubrosRepo.Ordenar(req.body));

    } catch(error:any){
        let msg = "Error al intentar ordenar las categorias.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.post('/agregar', async (req:Request, res:Response) => {
    try{ 
        res.json(await RubrosRepo.Agregar(req.body));

    } catch(error:any){
        let msg = "Error al intentar agregar el rubro.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.put('/modificar', async (req:Request, res:Response) => {
    try{ 
        res.json(await RubrosRepo.Modificar(req.body));

    } catch(error:any){
        let msg = "Error al intentar modificar el rubro.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response) => {
    try{ 
        res.json(await RubrosRepo.Eliminar(req.params.id));

    } catch(error:any){
        let msg = "Error al intentar eliminar el rubro.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

// Export the router
export default router; 