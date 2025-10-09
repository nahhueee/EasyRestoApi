import db from '../db/db.config';

class RubrosRepository{

    //#region OBTENER
    async Obtener(filtro:string){
        const connection = await db.getConnection();
        
        try {
           
            if(filtro != ""){
                filtro = " AND nombre LIKE '%"+ filtro + "%' ";
            }

            let query = " SELECT * " +
                        " FROM categorias " +
                        " WHERE id <> 1 " +
                        filtro +
                        " ORDER BY orden ASC ";

            const [resultado] = await connection.query(query);
            return [resultado][0];

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async RubrosSelector(){
        const connection = await db.getConnection();
        
        try {
            const [rows] = await connection.query('SELECT id, nombre, icono FROM categorias ORDER BY orden ASC');
            return [rows][0];

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    //#endregion

    //#region ABM
    async Ordenar(data:any): Promise<string>{
        const connection = await db.getConnection();
        try {
            
            for (const [index, categoria] of data.entries()) {
                await connection.query(
                    "UPDATE categorias SET orden = ? WHERE id = ?",
                    [index + 1, categoria.id]
                );
            }

            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async Agregar(data:any): Promise<string>{
        const connection = await db.getConnection();
        
        try {
            let existe = await ValidarExistencia(connection, data, false);
            if(existe)//Verificamos si ya existe una categoria con el mismo nombre 
                return "Ya existe una categoria con el mismo nombre.";
            
            const consulta = "INSERT INTO categorias(orden, nombre, icono) VALUES (?, ?, ?)";
            const parametros = [data.orden, data.nombre.toUpperCase(), data.icono];
            
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
            if(existe)//Verificamos si ya existe una categoria con el mismo nombre
                return "Ya existe una categoria con el mismo nombre.";
            
                const consulta = `UPDATE categorias 
                SET nombre = ?,
                    icono = ?
                WHERE id = ? `;

            const parametros = [data.nombre.toUpperCase(), data.icono, data.id];
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
            await connection.query("DELETE FROM categorias WHERE id = ?", [id]);
            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion
}

async function ValidarExistencia(connection, data:any, modificando:boolean):Promise<boolean>{
    try {
        let consulta = " SELECT id FROM categorias WHERE nombre = ? ";
        if(modificando) consulta += " AND id <> ? ";

        const parametros = [data.nombre.toUpperCase(), data.id];

        const rows = await connection.query(consulta,parametros);
        if(rows[0].length > 0) return true;

        return false;
    } catch (error) {
        throw error; 
    }
}

export const RubrosRepo = new RubrosRepository();