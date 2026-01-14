import db from '../db/db.config';
import { Mesa } from '../models/Mesa';

class MesasRepository{

    //#region OBTENER
    async Obtener(idSalon:string, idUsuario:string){
        const connection = await db.getConnection();
        
        try {
            const filtros: any[] = [];
            let sql = "";

            // Consulta base según salón
            if (idSalon !== '0') {
                sql = `
                    SELECT 
                        m.*,
                        m.numero AS codigo,
                        COALESCE(s.nombre, 'ELIMINADO') AS usuarioAsignado,
                        p.ticketImp
                    FROM mesas m
                    LEFT JOIN usuarios s ON s.id = m.asignacion
                    LEFT JOIN pedidos p ON p.id = m.idPedido
                    WHERE 1 = 1
                `;

                sql += " AND m.idSalon = ?";
                filtros.push(idSalon);

            } else {
                sql = `
                    SELECT 
                        m.id,
                        m.numero,
                        CASE 
                            WHEN m.combinada <> '' THEN CONCAT(s.descripcion, ' | ', m.combinada)
                            ELSE CONCAT(s.descripcion, ' | ', m.numero)
                        END AS codigo,
                        m.asignacion,
                        '' AS ticketImp
                    FROM mesas m
                    INNER JOIN salones s ON s.id = m.idSalon
                    WHERE 1 = 1
                `;
            }

            // Filtro por usuario si corresponde
            if (idUsuario !== '0') {
                sql += " AND m.asignacion = ?";
                filtros.push(idUsuario);
            }

            sql += " ORDER BY m.numero ASC";


            const [rows] = await connection.query(sql, filtros);

            const mesas:Mesa[] = [];
                       
            if (Array.isArray(rows)) {
                for (let i = 0; i < rows.length; i++) { 
                    const row = rows[i];

                    let mesa:Mesa = new Mesa();
                    mesa.id = row['id'];
                    mesa.numero = row['numero'];
                    mesa.codigo = row['codigo'];
                    mesa.idSalon = row['idSalon'];
                    mesa.idPedido = row['idPedido'];
                    mesa.codGrupo = row['codGrupo'];
                    mesa.principal = row['principal'] == 1 ? true : false;
                    mesa.combinada = row['combinada'];
                    mesa.asignacion = row['asignacion'];
                    mesa.usuarioAsignado = row['usuarioAsignado'];
                    
                    let estado = "Disponible";
                    if(mesa.idPedido != 0) estado = "Ocupada";
                    if(mesa.idPedido != 0 && (row['ticketImp'] != null && row['ticketImp'] != "")) estado = "Pago Pendiente"
                    mesa.estado = estado;
                    mesas.push(mesa);
                }
            }
            return mesas;

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
            if(existe)//Verificamos si ya existe una mesa con el mismo nombre 
                return "Ya existe una mesa con el mismo codigo.";
            
            const consulta = "INSERT INTO mesas(numero, idSalon) VALUES (?, ?)";
            const parametros = [data.numero, data.idSalon];
            
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
            if(existe)//Verificamos si ya existe una mesa con el mismo nombre
                return "Ya existe una mesa con el mismo codigo.";
            
                const consulta = `UPDATE mesas 
                SET numero = ?,
                    idSalon = ?,
                    idPedido = ?,
                    combinada = ?,
                    principal = ?,
                    asignacion = ?
                WHERE id = ? `;

            const parametros = [
                                data.numero, 
                                data.idSalon, 
                                data.idPedido, 
                                data.combinada, 
                                data.principal, 
                                data.asignacion, 
                                data.id
                            ];
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
            await connection.query("DELETE FROM mesas WHERE id = ?", [id]);
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
        query = count +
            " SELECT * " +
            " FROM mesas " +
            " WHERE id <> 1 " +
            filtro +
            " ORDER BY numero ASC " +
            paginado +
            endCount;

        return query;
            
    } catch (error) {
        throw error; 
    }
}

async function ValidarExistencia(connection, data:any, modificando:boolean):Promise<boolean>{
    try {
        let consulta = " SELECT id FROM mesas WHERE numero = ? AND idSalon = ? ";
        if(modificando) consulta += " AND id <> ? ";

        const parametros = [data.numero, data.idSalon, data.id];

        const rows = await connection.query(consulta,parametros);
        if(rows[0].length > 0) return true;

        return false;
    } catch (error) {
        throw error; 
    }
}

export const MesasRepo = new MesasRepository();