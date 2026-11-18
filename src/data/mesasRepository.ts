import db from '../db/db.config';
import { randomUUID } from 'crypto';
import { Mesa } from '../models/Mesa';

//Mesa centinela del seed (pedidos sin mesa). Nunca se edita, borra ni junta
const ID_MESA_NINGUNA = 1;
//Largo de mesas.combinada (varchar(30))
const LARGO_COMBINADA = 30;
const MAX_MESAS_POR_ALTA = 100;

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
                        p.ticketImp,
                        p.comandaImp,
                        p.total,
                        DATE_FORMAT(p.fecha, '%Y-%m-%d') AS fecha,
                        p.hora,
                        ur.nombre AS mozoPedido
                    FROM mesas m
                    LEFT JOIN usuarios s ON s.id = m.asignacion
                    LEFT JOIN pedidos p ON p.id = m.idPedido
                    LEFT JOIN usuarios ur ON ur.id = p.idResponsable
                    WHERE 1 = 1
                `;

                sql += " AND m.idSalon = ?";
                filtros.push(idSalon);

            } else {
                sql = `
                    SELECT 
                        m.id,
                        m.numero,
                        m.idPedido,
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

                    //Datos del pedido abierto (solo rama por salon; aditivos para no romper mobile)
                    if (idSalon !== '0') {
                        mesa.total = row['total'] != null ? Number(row['total']) : 0;
                        mesa.fecha = row['fecha'] ?? '';
                        mesa.hora = row['hora'] ?? '';
                        mesa.ticketImp = row['ticketImp'] ?? '';
                        mesa.comandaImp = row['comandaImp'] ?? '';
                        mesa.mozoPedido = row['mozoPedido'] ?? '';
                    }
                    
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
            if(Number(data.id) == ID_MESA_NINGUNA) return "Esta mesa no se puede modificar.";

            const [actual]:any = await connection.query("SELECT codGrupo FROM mesas WHERE id = ?", [data.id]);
            if(actual.length == 0) return "La mesa ya no existe. Actualizá la pantalla.";
            //Renumerar o mover una mesa junta deja 'combinada' y el grupo inconsistentes
            if(actual[0].codGrupo) return "Separá las mesas antes de modificarla.";

            let existe = await ValidarExistencia(connection, data, true);
            if(existe)//Verificamos si ya existe una mesa con el mismo nombre
                return "Ya existe una mesa con el mismo codigo.";

            //Solo numero y salon. idPedido, codGrupo, combinada, principal y asignacion tienen sus propios flujos:
            //pisarlos con la copia que manda el front liberaba mesas con pedido abierto ("mesa fantasma")
            const consulta = "UPDATE mesas SET numero = ?, idSalon = ? WHERE id = ?";
            await connection.query(consulta, [data.numero, data.idSalon, data.id]);
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
            if(Number(id) == ID_MESA_NINGUNA) return "Esta mesa no se puede eliminar.";

            //Borrado condicional en una sola sentencia: no hay ventana entre validar y borrar
            const [res]:any = await connection.query(
                "DELETE FROM mesas WHERE id = ? AND idPedido = 0 AND (codGrupo IS NULL OR codGrupo = '')", [id]);
            if(res.affectedRows > 0) return "OK";

            const [rows]:any = await connection.query("SELECT idPedido, codGrupo FROM mesas WHERE id = ?", [id]);
            if(rows.length == 0) return "OK"; //Ya no existia: mismo resultado que antes
            if(rows[0].idPedido != 0) return "La mesa tiene un pedido abierto.";
            return "Separá las mesas antes de eliminarla.";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion

    //#region OPERACIONES
    /** Junta mesas en un grupo. Principal: la que tiene pedido o, si ninguna, la de numero mas bajo (D2). */
    async Juntar(ids:any): Promise<string>{
        const idsMesas = NormalizarIds(ids);
        if(idsMesas.length < 2) return "Elegí al menos dos mesas para juntar.";
        if(idsMesas.includes(ID_MESA_NINGUNA)) return "Esa mesa no se puede juntar.";

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            //FOR UPDATE: si otra terminal abre un pedido en estas mesas, espera a que terminemos (y nosotros a ella)
            const [rows]:any = await connection.query(
                "SELECT id, numero, idSalon, idPedido, codGrupo FROM mesas WHERE id IN (?) FOR UPDATE", [idsMesas]);

            const error = ValidarJuntar(rows, idsMesas.length);
            if(error){
                await connection.rollback();
                return error;
            }

            const ordenadas = [...rows].sort((a:any, b:any) => a.numero - b.numero);
            const principal = rows.find((r:any) => r.idPedido != 0) ?? ordenadas[0];
            const combinada = ordenadas.map((r:any) => r.numero).join('-');
            if(combinada.length > LARGO_COMBINADA){
                await connection.rollback();
                return "Son demasiadas mesas para un mismo grupo.";
            }

            await connection.query(
                "UPDATE mesas SET codGrupo = ?, combinada = ?, principal = IF(id = ?, 1, 0) WHERE id IN (?)",
                [randomUUID(), combinada, principal.id, idsMesas]);

            await connection.commit();
            return "OK";

        } catch (error:any) {
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }

    /** Separa un grupo. El pedido queda en la principal: idPedido no se toca (D3). */
    async Separar(codGrupo:any): Promise<string>{
        if(typeof codGrupo !== 'string' || codGrupo.trim() === '') return "No se indicó el grupo a separar.";

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [rows]:any = await connection.query("SELECT id FROM mesas WHERE codGrupo = ? FOR UPDATE", [codGrupo]);
            if(rows.length == 0){
                await connection.rollback();
                return "Las mesas ya estaban separadas. Actualizá la pantalla.";
            }

            await connection.query("UPDATE mesas SET codGrupo = '', combinada = '', principal = 1 WHERE codGrupo = ?", [codGrupo]);

            await connection.commit();
            return "OK";

        } catch (error:any) {
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }

    /** Asigna (o quita con idUsuario = 0) el mozo de varias mesas. Solo toca 'asignacion'.
     *  Es una unica sentencia UPDATE: atomica por si misma, no necesita transaccion explicita. */
    async Asignar(data:any): Promise<string>{
        const idsMesas = NormalizarIds(data?.ids).filter(id => id != ID_MESA_NINGUNA);
        if(idsMesas.length == 0) return "Elegí al menos una mesa.";

        const idUsuario = Number(data?.idUsuario);
        if(!Number.isInteger(idUsuario) || idUsuario < 0) return "El mozo indicado no es válido.";

        const connection = await db.getConnection();
        try {
            await connection.query("UPDATE mesas SET asignacion = ? WHERE id IN (?)", [idUsuario, idsMesas]);
            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    /** Crea 'cantidad' mesas desde el numero 'desde'. Los numeros que ya existen en el salon se saltean (D4).
     *  La unicidad es por salon (misma regla que ValidarExistencia).
     *  Devuelve { creadas, salteadas } o un string con el error de regla. */
    async AgregarVarias(data:any): Promise<{creadas:number[], salteadas:number[]} | string>{
        const idSalon = Number(data?.idSalon);
        const desde = Number(data?.desde);
        const cantidad = Number(data?.cantidad);

        if(!Number.isInteger(idSalon) || idSalon <= 0) return "El salón indicado no es válido.";
        if(!Number.isInteger(desde) || desde < 1) return "El número inicial tiene que ser 1 o mayor.";
        if(!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_MESAS_POR_ALTA)
            return `La cantidad tiene que estar entre 1 y ${MAX_MESAS_POR_ALTA}.`;

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [salon]:any = await connection.query("SELECT id FROM salones WHERE id = ?", [idSalon]);
            if(salon.length == 0){
                await connection.rollback();
                return "El salón ya no existe. Actualizá la pantalla.";
            }

            const hasta = desde + cantidad - 1;
            const [rows]:any = await connection.query(
                "SELECT numero FROM mesas WHERE idSalon = ? AND numero BETWEEN ? AND ? FOR UPDATE", [idSalon, desde, hasta]);
            const existentes = new Set<number>(rows.map((r:any) => Number(r.numero)));

            const creadas:number[] = [];
            const salteadas:number[] = [];
            for(let numero = desde; numero <= hasta; numero++){
                if(existentes.has(numero)) salteadas.push(numero);
                else creadas.push(numero);
            }

            if(creadas.length > 0){
                await connection.query("INSERT INTO mesas(numero, idSalon) VALUES ?", [creadas.map(n => [n, idSalon])]);
            }

            await connection.commit();
            return { creadas, salteadas };

        } catch (error:any) {
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion
}

/** Ids numericos, positivos y sin repetir. */
function NormalizarIds(ids:any): number[]{
    if(!Array.isArray(ids)) return [];
    return [...new Set(ids.map((id:any) => Number(id)))].filter(id => Number.isInteger(id) && id > 0);
}

/** Reglas para juntar: todas existen, mismo salon, ninguna en un grupo, como mucho una con pedido. */
function ValidarJuntar(rows:any[], esperadas:number): string | null{
    if(rows.length != esperadas) return "Alguna de las mesas ya no existe. Actualizá la pantalla.";

    if(new Set(rows.map(r => r.idSalon)).size > 1) return "Las mesas tienen que ser del mismo salón.";

    const enGrupo = rows.find(r => r.codGrupo);
    if(enGrupo) return `La mesa ${enGrupo.numero} ya está junta con otra.`;

    if(rows.filter(r => r.idPedido != 0).length > 1) return "No se pueden juntar dos mesas con pedido abierto.";

    return null;
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
            " FROM mesas " +
            " WHERE id <> 1 " +
            filtro +
            " ORDER BY numero ASC " +
            paginado +
            endCount;

        return {query, params};

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