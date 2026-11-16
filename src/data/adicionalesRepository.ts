import db from '../db/db.config';

class AdicionalesRepository{

    //#region OBTENER
    async Obtener(filtros:any){
        const connection = await db.getConnection();
        
        try {
             //Obtengo la query segun los filtros
            let { query: queryRegistros, params: paramsRegistros } = await ObtenerQuery(filtros,false);
            let { query: queryTotal, params: paramsTotal } = await ObtenerQuery(filtros,true);

            //Obtengo la lista de registros y el total
            const rows = await connection.query(queryRegistros, paramsRegistros);
            const resultado = await connection.query(queryTotal, paramsTotal);

            return {total:resultado[0][0].total, registros:rows[0]};

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async AdicionalesSelector(){
        const connection = await db.getConnection();
        
        try {
            const [rows] = await connection.query('SELECT id, descripcion FROM adicionales');
            return [rows][0];

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
            if(existe)//Verificamos si ya existe un adicional con el mismo nombre 
                return "Ya existe un adicional con la misma descripción.";
            
            const consulta = "INSERT INTO adicionales(descripcion) VALUES (?)";
            const parametros = [data.descripcion.toUpperCase()];
            
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
            if(existe)//Verificamos si ya existe uno con el mismo nombre
                return "Ya existe un adicional con la misma descripción.";
            
                const consulta = `UPDATE adicionales 
                SET descripcion = ?
                WHERE id = ? `;

            const parametros = [data.descripcion.toUpperCase(), data.id];
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
            await connection.query("DELETE FROM adicionales WHERE id = ?", [id]);
            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion
}

async function ObtenerQuery(filtros:any,esTotal:boolean):Promise<{query:string, params:any[]}>{
    try {
        //#region VARIABLES
        let query:string;
        let params:any[] = [];
        let filtro:string = "";
        let paginado:string = "";
    
        let count:string = "";
        let endCount:string = "";
        //#endregion

        // #region FILTROS
        if (filtros.busqueda != null && filtros.busqueda != ""){
            filtro += " AND descripcion LIKE ? ";
            params.push("%" + filtros.busqueda + "%");
        }
        // #endregion

        if (esTotal)
        {//Si esTotal agregamos para obtener un total de la consulta
            count = "SELECT COUNT(*) AS total FROM ( ";
            endCount = " ) as subquery";
        }
        else
        {//De lo contrario paginamos
            if (filtros.tamanioPagina != null){
                const tamanio = Math.max(1, Number(filtros.tamanioPagina) || 10);
                const pagina = Math.max(1, Number(filtros.pagina) || 1);
                paginado = " LIMIT ? OFFSET ? ";
                params.push(tamanio, (pagina - 1) * tamanio);
            }
        }
            
        //Arma la Query con el paginado y los filtros correspondientes
        query = count +
            " SELECT * " +
            " FROM adicionales " +
            " WHERE 1 = 1 " +
            filtro +
            " ORDER BY id DESC " +
            paginado +
            endCount;

        return {query, params};

    } catch (error) {
        throw error; 
    }
}

async function ValidarExistencia(connection, data:any, modificando:boolean):Promise<boolean>{
    try {
        let consulta = " SELECT id FROM adicionales WHERE descripcion = ? ";
        if(modificando) consulta += " AND id <> ? ";

        const parametros = [data.descripcion.toUpperCase(), data.id];

        const rows = await connection.query(consulta,parametros);
        if(rows[0].length > 0) return true;

        return false;
    } catch (error) {
        throw error; 
    }
}

export const AdicionalesRepo = new AdicionalesRepository();