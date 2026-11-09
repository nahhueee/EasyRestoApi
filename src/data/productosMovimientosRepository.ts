import db from '../db/db.config';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
import type { ContextoAuditoria } from './productosRepository';

// Libro de stock auditable (architecture.md §12.4): una fila por cada cambio de
// `productos.cantidad` hecho a mano (stock inicial, ajustes, saldo de migración).
// Los movimientos por venta (motivo PEDIDO) quedan fuera de este handoff.
// Ver documentos/handoff_rework_productos_comandas.md, PR2.
//
// `import type` a propósito: productosRepository importa registrarMovimiento de acá;
// el tipo ContextoAuditoria se borra al compilar y no genera dependencia circular.

export type MotivoMovimiento = 'INICIAL' | 'INGRESO' | 'EGRESO' | 'CONTEO' | 'MIGRACION';
export type TipoAjusteStock = 'INGRESO' | 'EGRESO' | 'CONTEO';

const TIPOS_AJUSTE: TipoAjusteStock[] = ['INGRESO', 'EGRESO', 'CONTEO'];
const LARGO_MAX_OBSERVACION = 255;

export interface NuevoMovimiento {
    idProducto: number;
    motivo: MotivoMovimiento;
    cantidadDelta: number;
    cantidadResultante: number;
    observacion?: string | null;
    contexto?: ContextoAuditoria | null;
}

// Inserta un movimiento usando la conexión (y por lo tanto la transacción) del
// llamador: el movimiento y el cambio de cantidad confirman o se revierten juntos.
export async function registrarMovimiento(connection, mov:NuevoMovimiento): Promise<void>{
    const consulta = `INSERT INTO productos_movimientos
                        (idProducto, motivo, cantidadDelta, cantidadResultante, observacion, puesto, idUsuario)
                      VALUES(?,?,?,?,?,?,?)`;

    const parametros = [
        mov.idProducto,
        mov.motivo,
        mov.cantidadDelta,
        mov.cantidadResultante,
        mov.observacion ?? null,
        mov.contexto?.puesto ?? null,
        mov.contexto?.idUsuario ?? null
    ];

    await connection.query(consulta, parametros);
}

class ProductoMovimientosRepository{

    // Ajuste manual de stock. Siempre relativo (cantidad = cantidad + delta), nunca
    // un valor absoluto, y con el producto bloqueado: una venta concurrente no se pierde.
    async AjustarStock(idProducto:number, data:any, contexto:ContextoAuditoria): Promise<{ cantidadResultante:number }>{
        //#region VALIDAR ENTRADA
        const tipo:TipoAjusteStock = data?.tipo;
        if(!TIPOS_AJUSTE.includes(tipo))
            throw new AppError(CodigoError.VALIDACION, "Tipo de ajuste inválido.", 400);

        const cantidad = Number(data?.cantidad);
        if(data?.cantidad === null || data?.cantidad === undefined || data?.cantidad === '' || !Number.isInteger(cantidad) || cantidad < 0)
            throw new AppError(CodigoError.VALIDACION, "La cantidad debe ser un número entero mayor o igual a 0.", 400);

        const observacion = typeof data?.observacion === 'string' ? data.observacion.trim() : '';
        if(observacion.length > LARGO_MAX_OBSERVACION)
            throw new AppError(CodigoError.VALIDACION, "El motivo no puede superar los " + LARGO_MAX_OBSERVACION + " caracteres.", 400);
        //#endregion

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const [rows]:any = await connection.query("SELECT cantidad, controlaStock FROM productos WHERE id = ? FOR UPDATE", [idProducto]);
            const producto = rows[0];

            if(!producto)
                throw new AppError(CodigoError.NOT_FOUND, "El producto no existe.", 404);

            if(producto.controlaStock != 1)
                throw new AppError(CodigoError.VALIDACION, "Este producto no controla stock.", 400);

            const actual:number = producto.cantidad ?? 0;

            let delta:number;
            if(tipo === 'INGRESO') delta = cantidad;
            else if(tipo === 'EGRESO') delta = -cantidad;
            else delta = cantidad - actual; //CONTEO

            //Sin cambio real no se ensucia el historial
            if(delta === 0){
                await connection.commit();
                return { cantidadResultante: actual };
            }

            await connection.query("UPDATE productos SET cantidad = IFNULL(cantidad, 0) + ? WHERE id = ?", [delta, idProducto]);

            const cantidadResultante = actual + delta;
            await registrarMovimiento(connection, {
                idProducto,
                motivo: tipo,
                cantidadDelta: delta,
                cantidadResultante,
                observacion: observacion === '' ? null : observacion,
                contexto
            });

            await connection.commit();
            return { cantidadResultante };

        } catch (error:any) {
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }

    // Últimos N movimientos del producto, el más reciente primero.
    async ObtenerUltimos(idProducto:number, limite:number): Promise<any[]>{
        const connection = await db.getConnection();

        try {
            const consulta = ` SELECT m.id, m.fecha, m.motivo, m.cantidadDelta, m.cantidadResultante,
                                      m.observacion, m.puesto, m.idUsuario, u.nombre usuario
                               FROM productos_movimientos m
                               LEFT JOIN usuarios u ON u.id = m.idUsuario
                               WHERE m.idProducto = ?
                               ORDER BY m.fecha DESC, m.id DESC
                               LIMIT ? `;

            const [rows]:any = await connection.query(consulta, [idProducto, limite]);
            return rows;

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
}

export const movimientosRepository = new ProductoMovimientosRepository();
