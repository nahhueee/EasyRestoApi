import db from '../db/db.config';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';

class MovimientosRepository{

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
    //#endregion

    //#region ABM
    async Agregar(data:any): Promise<string>{
        const connection = await db.getConnection();

        try {
            //Iniciamos una transaccion
            await connection.beginTransaction();

            await InsertarMovimiento(connection, data);

            //Mandamos la transaccion
            await connection.commit();
            return "OK";

        } catch (error:any) {
            //Si ocurre un error volvemos todo para atras
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }

    //Anula un movimiento: inserta el movimiento inverso y marca el original con idMovimientoCompensado.
    //No borra nada del historial. Todo en una transaccion; el SELECT ... FOR UPDATE evita doble anulacion concurrente.
    async Anular(data:{id:number}): Promise<string>{
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const [rows]:any = await connection.query(
                " SELECT cm.*, c.finalizada " +
                " FROM cajas_movimientos cm " +
                " LEFT JOIN cajas c ON c.id = cm.idCaja " +
                " WHERE cm.id = ? FOR UPDATE ", [data.id]);
            const mov = rows[0];

            if(!mov)
                throw new AppError(CodigoError.VALIDACION, "El movimiento no existe.", 400);

            if(mov.finalizada == null)
                throw new AppError(CodigoError.VALIDACION, "La caja de este movimiento no existe.", 400);

            if(mov.finalizada)
                throw new AppError(CodigoError.VALIDACION, "No se puede anular: la caja #" + mov.idCaja + " de este movimiento está finalizada. Reabrila para hacer cambios.", 400);

            if(mov.idMovimientoCompensado != null)
                throw new AppError(CodigoError.VALIDACION, "Este movimiento ya fue anulado.", 400);

            const [inverso]:any = await connection.query("SELECT id FROM cajas_movimientos WHERE idMovimientoCompensado = ? LIMIT 1", [mov.id]);
            if(inverso.length > 0)
                throw new AppError(CodigoError.VALIDACION, "Este movimiento es la anulación de otro, no se puede volver a anular.", 400);

            //Movimiento inverso (misma caja y monto, tipo contrario)
            const tipoInverso = String(mov.tipoMovimiento).toUpperCase() == "ENTRADA" ? "SALIDA" : "ENTRADA";
            const descripcion = ("Anulación de mov. #" + mov.id + ": " + (mov.descripcion ?? "")).substring(0, 150);
            const idInverso = await InsertarMovimiento(connection, {idCaja: mov.idCaja, tipoMovimiento: tipoInverso, monto: mov.monto, descripcion});

            await connection.query("UPDATE cajas_movimientos SET idMovimientoCompensado = ? WHERE id = ?", [idInverso, mov.id]);

            await connection.commit();
            return "OK";

        } catch (error:any) {
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }

    async Eliminar(data:any): Promise<string>{
        const connection = await db.getConnection();
        
        try {
            //Eliminamos el movimiento
            await connection.query("DELETE FROM cajas_movimientos WHERE id = ?", [data.id]);

            //Actualizamos el monto de la caja
            if(data.tipoMovimiento.toUpperCase() == "ENTRADA")
                await connection.query("UPDATE cajas SET entradas = entradas - ? WHERE id = ?", [data.monto, data.idCaja]);

            if(data.tipoMovimiento.toUpperCase() == "SALIDA")
                await connection.query("UPDATE cajas SET salidas = salidas - ? WHERE id = ?", [data.monto, data.idCaja]);
            
            //Mandamos la transaccion
            await connection.commit();
            return "OK";

        } catch (error:any) {
            //Si ocurre un error volvemos todo para atras
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }
    //#endregion
}

//Inserta el movimiento y actualiza los totales de la caja usando la conexion (transaccion) recibida. Devuelve el id insertado.
async function InsertarMovimiento(connection:any, data:any): Promise<number>{
    const tipo = String(data.tipoMovimiento).toUpperCase();

    const [resultado]:any = await connection.query(
        " INSERT INTO cajas_movimientos(idCaja,tipoMovimiento,monto,descripcion) VALUES(?, ?, ?, ?) ",
        [data.idCaja, tipo, data.monto, data.descripcion]);

    //Actualizamos el monto de la caja
    if(tipo == "ENTRADA")
        await connection.query("UPDATE cajas SET entradas = entradas + ? WHERE id = ?", [data.monto, data.idCaja]);

    if(tipo == "SALIDA")
        await connection.query("UPDATE cajas SET salidas = salidas + ? WHERE id = ?", [data.monto, data.idCaja]);

    return resultado.insertId;
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
        filtro = " WHERE cm.idCaja = ? ";
        params.push(filtros.caja);

        if (filtros.tipoMovimiento != 0)
            filtro += " AND cm.tipoMovimiento = " + (filtros.tipoMovimiento == 1 ? "'ENTRADA'" : "'SALIDA'");
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
                " SELECT cm.*, " +
                //esAnulacion: este movimiento es el inverso generado al anular otro (no se puede volver a anular)
                " EXISTS(SELECT 1 FROM cajas_movimientos o WHERE o.idMovimientoCompensado = cm.id) AS esAnulacion " +
                " FROM cajas_movimientos cm " +
                filtro +
                " ORDER BY cm.id DESC " +
                paginado +
                endCount;

        return {query, params};

    } catch (error) {
        throw error; 
    }
}

export const MovimientosRepo = new MovimientosRepository();