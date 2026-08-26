import bcrypt from 'bcryptjs';
import db from '../db/db.config';

const BCRYPT_COST = 10;

class UsuariosRepository{

    //#region OBTENER
    async Obtener(filtros:any){
        const connection = await db.getConnection();
        
        try {
             //Obtengo la query segun los filtros
            let queryRegistros = await ObtenerQuery(filtros,false);
            let queryTotal = await ObtenerQuery(filtros,true);

            //Obtengo la lista de registros y el total
            const rows = await connection.query(queryRegistros);
            const resultado = await connection.query(queryTotal);

            return {total:resultado[0][0].total, registros:rows[0]};

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async ObtenerUsuario(filtros:any){
        const connection = await db.getConnection();
        
        try {
            let consulta = await ObtenerQuery(filtros,false);
            const rows = await connection.query(consulta);
            
            return rows[0][0];

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    // Login: la comparación de password es server-side con bcrypt.compare. Antes se hacía
    // en el navegador (ingresar.component.ts) contra el texto plano que el backend entregaba
    // en obtener-usuario/{id}: cualquiera con DevTools la leía. El hash nunca sale de acá.
    async Login(idUsuario:string, pass:string){
        const connection = await db.getConnection();

        try {
            const [rows] = await connection.query(
                " SELECT u.id, u.nombre, u.email, u.pass, u.idCargo, c.nombre cargo, u.idRol, r.nombre rol " +
                " FROM usuarios u " +
                " LEFT JOIN cargos c on c.id = u.idCargo " +
                " LEFT JOIN roles r on r.id = u.idRol " +
                " WHERE u.id = ? ",
                [idUsuario]
            );
            const usuario = (rows as any[])[0];

            // Mismo mensaje genérico exista o no el usuario — no confirmar a un atacante
            // si un id de usuario es válido.
            if (!usuario || !usuario.pass) return null;

            const valido = await bcrypt.compare(pass, usuario.pass);
            if (!valido) return null;

            delete usuario.pass;
            return usuario;

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async UsuariosSelector(){
        const connection = await db.getConnection();

        try {
            // Se agregan idCargo y el rol (mismo JOIN que Login) para que la pantalla de
            // ingreso pueda distinguir admin/empleado y etiquetar la fila sin una segunda
            // llamada a obtener-usuario/{id} al hacer click.
            const sql = " SELECT u.id, u.nombre, u.idCargo, c.nombre cargo, u.idRol, r.nombre rol FROM usuarios u" +
                        " LEFT JOIN cargos c on c.id = u.idCargo " +
                        " LEFT JOIN roles r on r.id = u.idRol ";

            const [rows] = await connection.query(sql);
            return [rows][0];

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async CargosSelector(){
        const connection = await db.getConnection();
        
        try {
            const [rows] = await connection.query('SELECT id, nombre FROM cargos');
            return [rows][0];

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async RolesSelector(){
        const connection = await db.getConnection();

        try {
            const [rows] = await connection.query('SELECT id, nombre FROM roles');
            return [rows][0];

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    // Primer chequeo de autorización server-side de la app (handoff PR3,
    // productosRoute.ts /precios/simular-ajuste y /precios/ajustar). El resto
    // de los gates "ADMINISTRADOR" existentes (main-productos, main-usuarios,
    // etc.) son solo de front -esto no los reemplaza, es puntual a ese
    // endpoint-. Mismo JOIN que Login().
    async EsAdministrador(idUsuario:number | null):Promise<boolean>{
        if (idUsuario == null) return false;

        const connection = await db.getConnection();
        try {
            const [rows] = await connection.query(
                "SELECT c.nombre cargo FROM usuarios u LEFT JOIN cargos c ON c.id = u.idCargo WHERE u.id = ?",
                [idUsuario]
            );
            const usuario = (rows as any[])[0];
            return usuario?.cargo === 'ADMINISTRADOR';

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion

    //#region ABM
    async Agregar(data:any): Promise<string>{
        const connection = await db.getConnection();
        
        try {
            let existe = await ValidarExistencia(connection, data, false);
            if(existe)//Verificamos si ya existe un usuario con el mismo nombre o correo
                return "Ya existe un usuario con el mismo nombre o correo.";
            
            //Los EMPLEADO no llevan contraseña — solo hasheamos si vino algo.
            //bcrypt.hash("") es válido pero no queremos consagrar una password vacía hasheada.
            const passGuardar = data.pass ? await bcrypt.hash(data.pass, BCRYPT_COST) : data.pass;

            const consulta = "INSERT INTO usuarios(nombre, email, pass, idCargo, idRol) VALUES (?, ?, ?, ?, ?)";
            const parametros = [data.nombre.toUpperCase(), data.email, passGuardar, data.cargo.id, data.rol.id];
            
            await connection.query(consulta, parametros);
            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async Modificar(data:any): Promise<string>{
        const connection = await db.getConnection();
        try {
            let existe = await ValidarExistencia(connection, data, true);

            if(existe)//Verificamos si ya existe un usuario con el mismo nombre o correo
                return "Ya existe un usuario con el mismo nombre o correo.";
            
            //Si data.pass viene vacío, el admin no quiere cambiar la contraseña (el front ya
            //no la precarga porque el backend no la devuelve más) — no tocar la columna, o
            //un UPDATE con pass='' pisaría el hash existente y nadie vuelve a entrar.
            const cambiarPass = !!data.pass;
            const setPass = cambiarPass ? " pass = ?, " : "";

            const consulta = `UPDATE usuarios
                              SET nombre = ?,
                              email = ?,
                              ${setPass}
                              idCargo = ?,
                              idRol = ?
                              WHERE id = ? `;

            const parametros = cambiarPass
                ? [data.nombre.toUpperCase(), data.email, await bcrypt.hash(data.pass, BCRYPT_COST), data.cargo.id, data.rol.id, data.id]
                : [data.nombre.toUpperCase(), data.email, data.cargo.id, data.rol.id, data.id];
            await connection.query(consulta, parametros);
            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async Eliminar(id:string): Promise<string>{
        const connection = await db.getConnection();
        
        try {
            await connection.query("DELETE FROM usuarios WHERE id = ?", [id]);
            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion
}

async function ObtenerQuery(filtros:any,esTotal:boolean):Promise<string>{
    try {
        //#region VARIABLES
        let query:string;
        let filtro:string = "";
        let paginado:string = "";
    
        let count:string = "";
        let endCount:string = "";
        //#endregion

        // #region FILTROS
        if (filtros.busqueda != null && filtros.busqueda != "") 
            filtro += " AND u.nombre LIKE '%"+ filtros.busqueda + "%' ";
        
        if(filtros.usuario != null && filtros.usuario != 0)
            filtro += " AND u.id = '" + filtros.usuario + "'";
        // #endregion

        if (esTotal)
        {//Si esTotal agregamos para obtener un total de la consulta
            count = "SELECT COUNT(*) AS total FROM ( ";
            endCount = " ) as subquery";
        }
        else
        {//De lo contrario paginamos
            if (filtros.tamanioPagina != null)
                paginado = " LIMIT " + filtros.tamanioPagina + " OFFSET " + ((filtros.pagina - 1) * filtros.tamanioPagina);
        }
            
        //Arma la Query con el paginado y los filtros correspondientes
        //Columnas explícitas (no u.*): pass nunca sale en ninguna respuesta del backend.
        //Con u.* el hash viajaba al front y addmod-usuarios lo reenviaba tal cual al
        //modificar, rehasheando el hash y dejando al usuario sin poder ingresar.
        query = count +
            " SELECT u.id, u.nombre, u.email, u.idCargo, u.idRol, c.nombre cargo, r.nombre rol " +
            " FROM usuarios u " +
            " LEFT JOIN cargos c on c.id = u.idCargo " +
            " LEFT JOIN roles r on r.id = u.idRol " +
            " WHERE 1 = 1 " +
            filtro +
            " ORDER BY u.id DESC" +
            paginado +
            endCount;
        
        return query;
            
    } catch (error) {
        throw error; 
    }
}

async function ValidarExistencia(connection, data:any, modificando:boolean):Promise<boolean>{
    try {
        let consulta = " SELECT * FROM usuarios WHERE nombre = ? ";
        if(modificando) consulta += " AND id <> ? ";

        const parametros = [data.nombre.toUpperCase(), data.id];

        const rows = await connection.query(consulta,parametros);
        if(rows[0].length > 0) return true;

        return false;
    } catch (error) {
        throw error; 
    }
}

export const UsuariosRepo = new UsuariosRepository();