import moment from 'moment';
import db from '../db/db.config';
import logger from '../log/logger';
import { Pedido } from '../models/Pedido';
import { DetallePedido } from '../models/PedidoDetalle';
import { Usuario } from '../models/Usuario';
import { Mesa } from '../models/Mesa';
import { TipoPedido } from '../models/TipoPedido';
import { PedidoPago } from '../models/PedidoPago';
import { PedidoFactura } from '../models/PedidoFactura';
import { ObjQR } from '../models/ObjQR';
import { TipoPago } from '../models/TipoPago';
import { DetallePago } from '../models/DetallePago';
import { ObjResumenPagos } from '../models/ObjResumen';

class PedidosRepository{

    //#region OBTENER
    async Obtener(filtros:any){
        const connection = await db.getConnection();
        
        try {
            //Obtengo la query segun los filtros
            let { query: queryRegistros, params: paramsRegistros } = await ObtenerQuery(filtros,false);
            let { query: queryTotal, params: paramsTotal } = await ObtenerQuery(filtros,true);

            //Obtengo la lista de registros y el total
            const [rows] = await connection.query(queryRegistros, paramsRegistros);
            const resultado = await connection.query(queryTotal, paramsTotal);
            const pedidos:Pedido[] = [];
           
            if (Array.isArray(rows)) {
                for (let i = 0; i < rows.length; i++) { 
                    const row = rows[i];
                    pedidos.push(await this.ArmarObjetoPedido(connection, row));
                  }
            }

            return {total:resultado[0][0].total, registros:pedidos, monto:Number(resultado[0][0].monto)};

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async ObtenerPedidosMozo(idMozo, idCaja){
        const connection = await db.getConnection();
        
        try {
            let { query: consulta, params } = await ObtenerQuery({responsable:parseInt(idMozo), idCaja:parseInt(idCaja), finalizado:1},false);
            const [rows] = await connection.query(consulta, params);
           
            const pedidos:ObjResumenPagos[] = [];
           
            if (Array.isArray(rows)) {
                for (let i = 0; i < rows.length; i++) { 
                    const row = rows[i];
                    let pedido:ObjResumenPagos = new ObjResumenPagos();
                    pedido.idPedido = row['id'];
                    pedido.mesa = row['numero'];
                    pedido.monto = parseFloat(row['total']);
                    pedido.pagos = await ObtenerDetallePagos(connection, row['id']); 

                    const pagoVisual = getPagoVisual(pedido.pagos);
                    pedido.metodoPago = pagoVisual?.nombre!;
                    pedido.metodoPagoAbrev = pagoVisual?.abreviatura!;

                    pedidos.push(pedido);
                  }
            }

            return pedidos;

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

     async ObtenerPedidosEnBaja(idCaja){
        const connection = await db.getConnection();
        
        try {
            //Obtengo la query segun los filtros
            const query = 
                " SELECT p.*, " +
                " tp.nombre tipo, COALESCE(u.nombre, 'NO SELECCIONADO') responsable, COALESCE(m.numero, 'NO SELECCIONADA') codigoMesa,  COALESCE(m.numero, 0) numero, s.descripcion salon" + 
                " FROM pedidos p " +
                " LEFT JOIN pedidos_tipo tp ON tp.id = p.idTipo " +
                " LEFT JOIN usuarios u ON u.id = p.idResponsable " +
                " LEFT JOIN mesas m ON m.id = p.idMesa " +
                " LEFT JOIN salones s ON s.id = m.idSalon " +
                " WHERE p.idCaja = ? AND p.fechaBaja IS NOT NULL " +
                " ORDER BY p.id DESC ";
               
            const [rows] = await connection.query(query, [idCaja]);
            const pedidos:Pedido[] = [];
           
            if (Array.isArray(rows)) {
                for (let i = 0; i < rows.length; i++) { 
                    const row = rows[i];
                    pedidos.push(await this.ArmarObjetoPedido(connection, row, true));
                  }
            }

            return pedidos;

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async ObtenerPedido(filtros){
        const connection = await db.getConnection();

        try {
            let { query: consulta, params } = await ObtenerQuery(filtros,false);
            const rows = await connection.query(consulta, params);
           
            const row = rows[0][0];
            return await this.ArmarObjetoPedido(connection, row);

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async ArmarObjetoPedido(connection, row, bajas:boolean=false){
        let pedido:Pedido = new Pedido();
        pedido.id = row['id'];
        pedido.idCaja = row['idCaja'];
        pedido.nroTicket = row['nroTicket'];
        pedido.fecha = row['fecha'];
        pedido.hora = row['hora'];
        pedido.obs = row['obs'];
        pedido.cliente = row['cliente'];
        pedido.total = row['total'];
        pedido.finalizado = row['finalizado'];
        pedido.ticketImp = row['ticketImp'];
        pedido.comandaImp = row['comandaImp'];
        pedido.responsable = new Usuario({id: row['idResponsable'], nombre: row['responsable']});
        pedido.tipo = new TipoPedido({id: row['idTipo'], nombre: row['tipo']});
        pedido.obsBaja = row['obsBaja'];
        
        const codigoMesa = row['codigoMesa'] != 'NO SELECCIONADA' ? row['codigoMesa'] + " | " + row['salon'] : row['codigoMesa'];
        pedido.mesa = new Mesa({id: row['idMesa'], codigo: codigoMesa});

        //Obtiene la lista de detalles del pedido
        pedido.detalles = await ObtenerDetallePedido(connection, row['id']); 

        if(!bajas){
            pedido.pago = new PedidoPago({
                recargo: parseFloat(row['recargo']),
                descuento: parseFloat(row['descuento']),
                tipoRecDes: row['tipoRecDes'],
                obs: row['pagoObs'],
                realizado: row['realizado'],
            });

            pedido.detallePago = await ObtenerDetallePagos(connection, row['id']); 

            pedido.factura = new PedidoFactura({
                cae: row['cae'], 
                caeVto: row['caeVto'], 
                ticket: row['ticket'], 
                tipoFactura: row['tipoFactura'], 
                neto: parseFloat(row['neto']), 
                iva: parseFloat(row['iva']), 
                dni: row['dni'],
                tipoDni: row['tipoDni'],
                ptoVenta: row['ptoVenta'],
            });
        }
        
        return pedido;
    }
    //#endregion

    //#region ABM
    async Agregar(pedido:Pedido): Promise<string>{
        const connection = await db.getConnection();

        try {
            //Iniciamos una transaccion
            await connection.beginTransaction();

            if(pedido.mesa == null){
                pedido.mesa = {id:0}
            }

            //Numero de ticket corto (reinicia por caja). Salon se identifica por mesa: no consume numeros, asi la secuencia de mostrador no tiene saltos
            pedido.nroTicket = pedido.tipo?.id === 1 ? undefined : await ObtenerProximoNroTicket(connection, pedido.idCaja ?? 0, moment(pedido.fecha).format('YYYY-MM-DD'));

            //El total lo define el servidor (items activos + recargo/descuento), no el que manda el cliente
            pedido.total = CalcularTotalPedido(pedido.detalles, pedido.pago);

            //Insertamos la venta. El id real es el del auto-increment (el MAX+1 de arriba puede quedar viejo si dos terminales guardan a la vez)
            pedido.id = await InsertPedido(connection, pedido);

            //Marcamos la mesa como no disponible
            if(pedido.mesa?.id != 0){
                await connection.query("UPDATE mesas SET idPedido = ? WHERE id = ?", [pedido.id, pedido.mesa?.id]);
            }

            //Insertamos los detalles de la venta
            for (const element of  pedido.detalles!) {
                element.idPedido = pedido.id;
                await InsertDetallePedido(connection, element);
            };

            //Si esta agregando algun descuento o recargo
            if(pedido.pago){
                await connection.query("DELETE FROM pedidos_pago WHERE idPedido = ?", [pedido.id]);
                pedido.pago.idPedido = pedido.id;
                await InsertPagoPedido(connection, pedido.pago);
                //await InsertPagoPedidoDetalle(connection, pedido.pago);
            }

            //Mandamos la transaccion
            await connection.commit();
            return pedido.id.toString();

        } catch (error:any) {
            //Si ocurre un error volvemos todo para atras
            await connection.rollback();
            throw error;
        } finally{
            connection.release();
        }
    }

    async Modificar(pedido:Pedido): Promise<string>{
        const connection = await db.getConnection();

        try {
            //Iniciamos una transaccion
            await connection.beginTransaction();

            if(!pedido.mesa){
                pedido.mesa = {id:0};
            }

            //El total lo define el servidor (items activos + recargo/descuento), no el que manda el cliente
            pedido.total = CalcularTotalPedido(pedido.detalles, pedido.pago);

            //Insertamos la venta
            await UpdatePedido(connection, pedido);

            //Marcamos la mesa como no disponible
            if(pedido.mesa?.id != 0){
                await connection.query("UPDATE mesas SET idPedido = 0 WHERE id = ?", [pedido.mesa?.id]); //Desmarcamos la anterior
                await connection.query("UPDATE mesas SET idPedido = ? WHERE id = ?", [pedido.id, pedido.mesa?.id]); //Marcamos la nueva
            }

            //Eliminamos los detalles del pedido
            await connection.query("DELETE FROM pedidos_detalle WHERE idPedido = ?", [pedido.id]);

            //Insertamos los detalles del pedido
            for (const element of  pedido.detalles!) {
                element.idPedido = pedido.id;
                await InsertDetallePedido(connection, element);
            };

            //Si esta agregando algun descuento o recargo
            if(pedido.pago){
                await connection.query("DELETE FROM pedidos_pago WHERE idPedido = ?", [pedido.id]);
                pedido.pago.idPedido = pedido.id;
                await InsertPagoPedido(connection, pedido.pago);
            }

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

    async Finalizar(pedido:Pedido): Promise<string>{
        const connection = await db.getConnection();

        try {
            //Iniciamos una transaccion
            await connection.beginTransaction();

            //El total lo define el servidor con los items activos que hay en la base (los quitados no cuentan).
            //Al finalizar el ajuste vigente es el del pago que llega; al revertir, el que ya estaba guardado.
            let pagoCalculo:any = pedido.pago;
            if(pedido.finalizado != 1){
                const [pagoRows]:any = await connection.query("SELECT recargo, descuento, tipoRecDes FROM pedidos_pago WHERE idPedido = ?", [pedido.id]);
                pagoCalculo = Array.isArray(pagoRows) ? pagoRows[0] : undefined;
            }
            const [detalleRows]:any = await connection.query("SELECT total, quitado FROM pedidos_detalle WHERE idPedido = ?", [pedido.id]);
            const totalCalculado = CalcularTotalPedido(detalleRows, pagoCalculo);

            if(Math.abs(totalCalculado - (Number(pedido.total) || 0)) > 0.01){
                logger.warn(`Pedido ${pedido.id}: el total del cliente (${pedido.total}) difiere del calculado por el servidor (${totalCalculado}). Se usa el del servidor.`);
            }
            pedido.total = totalCalculado;

            //Los montos de pago tienen que sumar el total: el ultimo se ajusta (igual que total2 = total - total1 en el cobro)
            if(pedido.finalizado == 1 && pedido.detallePago && pedido.detallePago.length > 0){
                const detallesPago = pedido.detallePago;
                const acumulado = detallesPago.slice(0, -1).reduce((acc, d) => acc + (Number(d.monto) || 0), 0);
                const ultimo = Redondear2(totalCalculado - acumulado);
                if(ultimo < 0){
                    await connection.rollback();
                    return "Los montos de pago superan el total del pedido. Revisá el pedido y volvé a cobrar.";
                }
                detallesPago[detallesPago.length - 1].monto = ultimo;
            }

            //Actualizamos el estado del pedido
            await connection.query("UPDATE pedidos SET finalizado = ?, total = ? WHERE id = ?", [pedido.finalizado, pedido.total, pedido.id]);

            //Marcamos la mesa como disponible
            if(pedido.mesa?.id != 0){
                await connection.query("UPDATE mesas SET idPedido = 0 WHERE id = ?", [pedido.mesa?.id]); 
            }

            //Si esta finalizando agregamos los detalles del pago
            if(pedido.pago && pedido.finalizado == 1){
                await connection.query("DELETE FROM pedidos_pago WHERE idPedido = ?", [pedido.id]);
                await connection.query("DELETE FROM pedidos_pagos_detalle WHERE idPedido = ?", [pedido.id]);
                pedido.pago.idPedido = pedido.id;
                pedido.pago.monto = pedido.total;
                await InsertPagoPedido(connection, pedido.pago);

                for (const element of  pedido.detallePago!) {
                    await InsertPagoPedidoDetalle(connection, element);
                }
            }

            //Guardamos datos de facturacion
            if(pedido.factura?.cae && pedido.finalizado == 1){
                pedido.factura.idPedido = pedido.id;
                await InsertFacturaPedido(connection, pedido.factura);
            }  
            
            //Actualizamos inventario. Ya no depende de `tipoProd` del payload: el filtro
            //(controlaStock = 1) se resuelve en la base, leyendo el producto real.
            for (const element of  pedido.detalles!.filter(d => !d.quitado)) {
                const signo = pedido.finalizado ? "-" : "+";

                await ActualizarInventario(connection, element, signo)
            };

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

    async ActualizarEstadoImpreso(data:any): Promise<string>{
        const connection = await db.getConnection();
        
        try {
            await connection.query("UPDATE pedidos SET ticketImp = ?, comandaImp = ? WHERE id = ?", [data.ticketImp, data.comandaImp, data.idPedido]);
            return "OK";
             
        } catch (error:any) {
            //Si ocurre un error volvemos todo para atras
            throw error;
        } finally{
            connection.release();
        }
    }

    async GuardarFactura(data:any){
        const connection = await db.getConnection();
        
        try {
            data.factura.idPedido = data.idPedido;
            await InsertFacturaPedido(connection, data.factura);
            return("OK");

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async Eliminar(id:string, obs:string): Promise<string>{
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            //Bajamos el pedido
            await connection.query(
                "UPDATE pedidos SET fechaBaja = ?, obsBaja = ? WHERE id = ?",
                [new Date(), obs, id]
            );

            //Marcamos la mesa como disponible
            await connection.query(
                "UPDATE mesas SET idPedido = 0 WHERE idPedido = ?",
                [id]
            );

            await connection.commit();
            return "OK";
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    // El front imprime con el objeto pedido que tiene en memoria y ahi aun no esta el nroTicket recien asignado.
    // filesRoute lo completa con este metodo antes de generar comanda o comprobante.
    async ObtenerNroTicket(idPedido:number): Promise<number | null>{
        const connection = await db.getConnection();
        try {
            const [rows] = await connection.query("SELECT nroTicket FROM pedidos WHERE id = ?", [idPedido]);
            return rows[0]?.nroTicket ?? null;
        } finally {
            connection.release();
        }
    }

    async ObtenerQRFactura(idVenta:number){
        const connection = await db.getConnection();

        try {
            const consulta = " SELECT pf.cae, pf.ticket, pf.tipoFactura, pf.neto, pf.iva, pf.dni, pf.tipodni, pf.ptoVenta, p.fecha " +
                             " FROM pedidos_factura pf " +
                             " INNER JOIN pedidos p on p.id = pf.idPedido " +
                             " WHERE pf.idPedido = ? "

            const [resultado] = await connection.query(consulta, idVenta);
            const row = resultado[0];

            const objQR = new ObjQR({
                ver: 1,
                fecha : moment(row['fecha']).format('YYYY-MM-DD'),
                ptoVta : row['ptoVenta'],
                tipoCmp : row['tipoFactura'],
                nroCmp : row['ticket'],
                importe : parseFloat(row['neto']) + parseFloat(row['iva']), 
                moneda : "PES",
                ctz : 1,
                tipoDocRec : row['tipodni'],
                nroDocRec : row['dni'],
                tipoCodAut : "E",
                codAut : row['cae']
            })

            return objQR;
            
        } catch (error) {
            throw error;
        }finally{
            connection.release();
        }
    }
    //#endregion
}

//#region INSERT UPDATE
// Proximo nroTicket: por caja si idCaja > 0; si no hay caja (modo pedidos, en deprecacion) reinicia por dia.
// No filtra por fechaBaja a proposito: el numero de un pedido eliminado no se reutiliza.
// Serializa terminales con un mutex sobre una fila que siempre existe (la caja; sin caja, el parametro modoTrabajo). Bloquear el rango de
// `pedidos` con FOR UPDATE daba gap locks compatibles entre si y deadlock en el primer pedido de una caja vacia.
// El SELECT de abajo corre despues del lock, asi que ve lo que commiteo la terminal anterior.
async function ObtenerProximoNroTicket(connection, idCaja:number, fecha:string):Promise<number>{
    if(idCaja > 0)
        await connection.query("SELECT id FROM cajas WHERE id = ? FOR UPDATE", [idCaja]);
    else
        await connection.query("SELECT clave FROM parametros WHERE clave = 'modoTrabajo' FOR UPDATE");

    const consulta = idCaja > 0
        ? " SELECT COALESCE(MAX(nroTicket),0) + 1 AS prox FROM pedidos WHERE idCaja = ? "
        : " SELECT COALESCE(MAX(nroTicket),0) + 1 AS prox FROM pedidos WHERE idCaja = 0 AND fecha = ? ";
    const [rows] = await connection.query(consulta, [idCaja > 0 ? idCaja : fecha]);
    return Number(rows[0].prox);
}

async function InsertPedido(connection, pedido):Promise<number>{
    try {
       const consulta = " INSERT INTO pedidos(idCaja,idTipo,idResponsable,cliente,idMesa,fecha,hora,obs,total,finalizado,nroTicket) " +
                        " VALUES(?,?,?,?,?,?,?,?,?,?,?) ";

        const parametros = [pedido.idCaja, pedido.tipo.id, pedido.responsable.id, pedido.cliente.toUpperCase(), pedido.mesa.id, moment(pedido.fecha).format('YYYY-MM-DD'), pedido.hora, pedido.obs, pedido.total, 0, pedido.nroTicket ?? null];
        const [resultado] = await connection.query(consulta, parametros);
        return resultado.insertId;
        
    } catch (error) {
        throw error; 
    }
}
async function InsertPagoPedido(connection, pago):Promise<void>{
    try {
        const consulta = " INSERT INTO pedidos_pago(idPedido, recargo, descuento, tipoRecDes, obs, realizado, monto) " +
                         " VALUES(?, ?, ?, ?, ?, ?, ?) ";

        const parametros = [pago.idPedido, pago.recargo, pago.descuento, pago.tipoRecDes, pago.obs, pago.realizado, pago.monto ?? 0];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}

async function InsertPagoPedidoDetalle(connection, pago):Promise<void>{
    try {
        const consulta = " INSERT INTO pedidos_pagos_detalle(idPedido, idTPago, monto) " +
                         " VALUES(?, ?, ?) ";

        const parametros = [pago.idPedido, pago.tipoPago.id, pago.monto];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}

async function InsertFacturaPedido(connection, factura):Promise<void>{
    try {
        const consulta = " INSERT INTO pedidos_factura(idPedido, cae, caeVto, ticket, tipoFactura, neto, iva, dni, tipoDni, ptoVenta) " +
                         " VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ";

        const parametros = [factura.idPedido, factura.cae, moment(factura.caeVto).format('YYYY-MM-DD'), factura.ticket, factura.tipoFactura, factura.neto, factura.iva, factura.dni, factura.tipoDni, factura.ptoVenta];
        await connection.query(consulta, parametros);

    } catch (error) {
        throw error; 
    }
}

async function UpdatePedido(connection, pedido):Promise<void>{
    try {
       const consulta = `UPDATE pedidos SET
                            idCaja = ?,
                            idtipo = ?,
                            idResponsable = ?,
                            cliente = ?,
                            idMesa = ?,
                            fecha = ?,
                            hora = ?,
                            obs = ?,
                            total = ?
                          WHERE id = ?`;
                              

        const parametros = [pedido.idCaja, pedido.tipo.id,pedido.responsable.id, pedido.cliente.toUpperCase(), pedido.mesa.id, moment(pedido.fecha).format('YYYY-MM-DD'), pedido.hora, pedido.obs, pedido.total, pedido.id];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}
//#endregion

//#region CALCULO DE TOTALES
function Redondear2(valor:number):number{
    return Math.round((valor + Number.EPSILON) * 100) / 100;
}

// Total de un pedido: suma de los items activos (los quitados no cuentan) mas recargo/descuento.
// Misma formula que comprobanteService (el ajuste se calcula sobre la suma de items).
// Acepta detalles del modelo o filas de la base (total puede venir como string, quitado como 0/1/null).
function CalcularTotalPedido(detalles:any[]|undefined, pago?:any):number{
    const base = (detalles ?? [])
        .filter(d => !d.quitado)
        .reduce((acc, d) => acc + (Number(d.total) || 0), 0);

    const descuento = Number(pago?.descuento) || 0;
    const recargo = Number(pago?.recargo) || 0;
    const esPorcentaje = pago?.tipoRecDes == "Porcentaje";

    let total = base;
    if(descuento != 0) total -= esPorcentaje ? base * descuento / 100 : descuento;
    if(recargo != 0) total += esPorcentaje ? base * recargo / 100 : recargo;

    return Redondear2(total);
}
//#endregion

//#region DETALLE PEDIDOS
async function ObtenerDetallePedido(connection, idPedido:number){
    try {
        // LEFT JOIN: las líneas "varios" (idProducto NULL) y las de productos ya borrados deben volver igual;
        // con INNER JOIN desaparecían al reabrir el pedido y se perdían del todo en la primera modificación.
        const consulta = " SELECT pd.*, p.tipo FROM pedidos_detalle pd " +
                         " LEFT JOIN productos p ON p.id = pd.idProducto " +
                         " WHERE pd.idPedido = ?";

        const [rows] = await connection.query(consulta, [idPedido]);

        const detalles:DetallePedido[] = [];

        if (Array.isArray(rows)) {
            for (let i = 0; i < rows.length; i++) { 
                const row = rows[i];
                
                let detalle:DetallePedido = new DetallePedido();
                detalle.id = row['id'];
                detalle.idPedido = row['idPedido'];
                detalle.cantidad = row['cantidad'];
                detalle.costo = parseFloat(row['costo']);
                detalle.unitario = parseFloat(row['unitario']);
                detalle.total = parseFloat(row['total']);
                detalle.producto = row['descripcion'];
                detalle.idProducto = row['idProducto'];
                detalle.tipoProd = row['tipo'];
                detalle.obs = row['obs'];
                detalle.quitado = row['quitado'] == 1 ? true : false;
                detalles.push(detalle)
              }
        }

        return detalles;

    } catch (error) {
        throw error; 
    }
}

async function ObtenerDetallePagos(connection, idPedido:number){
    try {
        const consulta = " SELECT pd.*, tp.id idTipoPago, tp.nombre, tp.icono, tp.color FROM pedidos_pagos_detalle pd " +
                         " INNER JOIN tipos_pago tp ON tp.id = pd.idTPago " +
                         " WHERE pd.idPedido = ?";

        const [rows] = await connection.query(consulta, [idPedido]);

        const detalles:DetallePago[] = [];

        if (Array.isArray(rows)) {
            for (let i = 0; i < rows.length; i++) { 
                const row = rows[i];
                
                let detalle:DetallePago = new DetallePago();
                detalle.idPedido = row['idPedido'];
                detalle.tipoPago = new TipoPago({
                    id: row['idTipoPago'],
                    nombre: row['nombre'],
                    icono: row['icono'],
                    color: row['color'],
                });
                detalle.monto = parseFloat(row['monto']);
                detalles.push(detalle)
              }
        }

        return detalles;

    } catch (error) {
        throw error; 
    }
}

async function InsertDetallePedido(connection, detalle):Promise<void>{
    try {
        const consulta = " INSERT INTO pedidos_detalle(idPedido, idProducto, descripcion, cantidad, costo, unitario, total, obs, quitado) " +
                         " VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?) ";

        const parametros = [detalle.idPedido, detalle.idProducto, detalle.producto, detalle.cantidad, detalle.costo, detalle.unitario, detalle.total, detalle.obs, detalle.quitado ? 1 : 0];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}

async function ActualizarInventario(connection, detalle, operacion):Promise<void>{
    try {
        const consulta = `UPDATE productos SET cantidad = IFNULL(cantidad, 0) ${operacion} ? 
                          WHERE id = ? AND controlaStock = 1`;

        const parametros = [detalle.cantidad, detalle.idProducto];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}
//#endregion

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
            filtro += " AND nombre LIKE ? ";
            params.push("%" + filtros.busqueda + "%");
        }

        if (filtros.idPedido != "" && filtros.idPedido != null)
        {
            filtro += " AND p.id = ? ";
            params.push(filtros.idPedido);
        }
        else
        {   
            if (filtros.idCaja != 0) { filtro += " AND p.idCaja = ? "; params.push(filtros.idCaja); }
            if (filtros.tipoPedido && filtros.tipoPedido != 0) { filtro += " AND p.idTipo = ? "; params.push(filtros.tipoPedido); }
            if (filtros.responsable != 0) { filtro += " AND p.idResponsable = ? "; params.push(filtros.responsable); }
            if (filtros.cliente != null) { filtro += " AND p.cliente LIKE ? "; params.push("%" + filtros.cliente + "%"); }

            //numero: lo que ve el usuario como "Nro." (nroTicket, o el id en los pedidos que no tienen nroTicket).
            //A diferencia de idPedido, convive con el resto de los filtros (caja, tipo, finalizado, etc.)
            if (filtros.numero != null && filtros.numero !== "" && Number.isInteger(Number(filtros.numero))) {
                filtro += " AND (p.nroTicket = ? OR (p.nroTicket IS NULL AND p.id = ?)) ";
                params.push(Number(filtros.numero), Number(filtros.numero));
            }

            if (filtros.fecha != null) { filtro += " AND p.fecha = '" + moment(filtros.fecha).format('YYYY-MM-DD') + "' "; }

            filtro += (filtros.finalizado) ? " AND p.finalizado = 1 " : " AND p.finalizado = 0 ";
        }
        // #endregion

        if (esTotal)
        {//Si esTotal agregamos para obtener un total de la consulta
            count = "SELECT COUNT(*) AS total, COALESCE(SUM(subquery.total), 0) AS monto FROM ( ";
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
                " SELECT p.*, " +
                " tp.nombre tipo, COALESCE(u.nombre, 'NO SELECCIONADO') responsable, COALESCE(m.numero, 'NO SELECCIONADA') codigoMesa,  COALESCE(m.numero, 0) numero, s.descripcion salon, " + //Varios
                " pp.realizado, pp.recargo, pp.descuento, pp.tipoRecDes, pp.obs pagoObs, " + //Pago
                " pfac.cae, pfac.caeVto, pfac.ticket, pfac.tipoFactura, pfac.neto, pfac.iva, pfac.dni, pfac.tipoDni, pfac.ptoVenta " + //Factura
                " FROM pedidos p " +
                " LEFT JOIN pedidos_tipo tp ON tp.id = p.idTipo " +
                " LEFT JOIN usuarios u ON u.id = p.idResponsable " +
                " LEFT JOIN mesas m ON m.id = p.idMesa " +
                " LEFT JOIN salones s ON s.id = m.idSalon " +
                " LEFT JOIN pedidos_pago pp ON pp.idPedido = p.id " +
                " LEFT JOIN pedidos_factura pfac ON pfac.idPedido = p.id " +
                " WHERE fechaBaja IS NULL " +
                filtro +
                " ORDER BY p.id DESC " +
                paginado +
                endCount;

        return {query, params};

    } catch (error) {
        throw error; 
    }
}

function getPagoVisual(detalles: DetallePago[]){
    if (!detalles?.length) return null;
    if (detalles.length === 1){
        const tp = detalles[0].tipoPago;
        return {
            abreviatura: tp.nombre?.toUpperCase().substring(0,4),
            nombre: tp.nombre,
        };
    }

    return { abreviatura: 'COMB', nombre: 'COMBINADO' };
}

export const PedidosRepo = new PedidosRepository();