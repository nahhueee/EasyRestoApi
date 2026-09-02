import {UsuariosRepo} from '../data/usuariosRepository';
import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
const router : Router  = Router();

router.post('/login', async (req:Request, res:Response, next) => {
    try{
        const usuario = await UsuariosRepo.Login(req.body.idUsuario, req.body.pass);

        //401 y no 500: es un error de usuario esperado, no una falla del sistema.
        //Mensaje único para usuario inexistente y password incorrecta.
        if(!usuario) return res.status(401).json({ message: "Usuario o contraseña incorrecta." });

        res.json(usuario);

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar iniciar sesión.", 500, { modulo: 'usuariosRoute.login' }, error));
    }
});

//#region OBTENER
router.post('/obtener', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await UsuariosRepo.Obtener(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el listado de usuarios.", 500, { modulo: 'usuariosRoute.obtener' }, error));
    }
});

router.get('/obtener-usuario/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await UsuariosRepo.ObtenerUsuario({usuario: req.params.id }));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el usuario nro " + req.params.id + ".", 500, { modulo: 'usuariosRoute.obtener-usuario' }, error));
    }
});


router.get('/selector-cargos', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await UsuariosRepo.CargosSelector());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el selector de cargos.", 500, { modulo: 'usuariosRoute.selector-cargos' }, error));
    }
});

router.get('/selector-roles', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await UsuariosRepo.RolesSelector());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el selector de roles.", 500, { modulo: 'usuariosRoute.selector-roles' }, error));
    }
});

router.get('/selector', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await UsuariosRepo.UsuariosSelector());

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener el selector de usuarios.", 500, { modulo: 'usuariosRoute.selector' }, error));
    }
});
//#endregion

//#region ABM
router.post('/agregar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await UsuariosRepo.Agregar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar agregar el usuario.", 500, { modulo: 'usuariosRoute.agregar' }, error));
    }
});

router.put('/modificar', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await UsuariosRepo.Modificar(req.body));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar modificar el usuario.", 500, { modulo: 'usuariosRoute.modificar' }, error));
    }
});

router.delete('/eliminar/:id', async (req:Request, res:Response, next) => {
    try{ 
        res.json(await UsuariosRepo.Eliminar(req.params.id));

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al intentar eliminar el usuario.", 500, { modulo: 'usuariosRoute.eliminar' }, error));
    }
});
//#endregion

// Export the router
export default router; 