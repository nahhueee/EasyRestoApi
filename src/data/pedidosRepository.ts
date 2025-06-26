import moment from 'moment';
import db from '../db/db.config';
import { Pedido } from '../models/Pedido';
import { DetallePedido } from '../models/PedidoDetalle';
import { Usuario } from '../models/Usuario';
import { Mesa } from '../models/Mesa';
import { TipoPedido } from '../models/TipoPedido';
import { PedidoPago } from '../models/PedidoPago';
import { PedidoFactura } from '../models/PedidoFactura';
import { ObjQR } from '../models/ObjQR';
import { TipoPago } from '../models/TipoPago';

class PedidosRepository{

    //#region OBTENER
    async Obtener(filtros:any){
        const connection = await db.getConnection();
        
        try {
             //Obtengo la query segun los filtros
            let queryRegistros = await ObtenerQuery(filtros,false);
            let queryTotal = await ObtenerQuery(filtros,true);

            //Obtengo la lista de registros y el total
            const [rows] = await connection.query(queryRegistros);
            const resultado = await connection.query(queryTotal);
            const pedidos:Pedido[] = [];
           
            if (Array.isArray(rows)) {
                for (let i = 0; i < rows.length; i++) { 
                    const row = rows[i];
                    pedidos.push(await this.ArmarObjetoPedido(connection, row));
                  }
            }

            return {total:resultado[0][0].total, registros:pedidos};

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async ObtenerPedido(filtros){
        const connection = await db.getConnection();

        try {
            let consulta = await ObtenerQuery(filtros,false);
            const rows = await connection.query(consulta);
           
            const row = rows[0][0];
            return await this.ArmarObjetoPedido(connection, row);

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async ArmarObjetoPedido(connection, row){
        let pedido:Pedido = new Pedido();
        pedido.id = row['id'];
        pedido.fecha = row['fecha'];
        pedido.hora = row['hora'];
        pedido.obs = row['obs'];
        pedido.cliente = row['cliente'];
        pedido.total = row['total'];
        pedido.finalizado = row['finalizado'];
        
        //Obtiene la lista de detalles del pedido
        pedido.detalles = await ObtenerDetallePedido(connection, row['id']); 

        pedido.responsable = new Usuario({id: row['idResponsable'], nombre: row['responsable']});
        pedido.mesa = new Mesa({id: row['idMesa'], codigo: row['codigoMesa']});
        pedido.tipoPedido = new TipoPedido({id: row['idTipo'], codigo: row['tipo']});


        pedido.pago = new PedidoPago({
            efectivo: parseFloat(row['efectivo']), 
            digital: parseFloat(row['digital']), 
            recargo: parseFloat(row['recargo']), 
            descuento: parseFloat(row['descuento']), 
            tipoPago: new TipoPago({id: row['idTipoPago'], nombre: row['tipoPago']}),
            realizado: row['realizado'],
        });

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

        return pedido;
    }
    //#endregion

    //#region ABM
    async Agregar(pedido:Pedido): Promise<string>{
        const connection = await db.getConnection();
        
        try {
            //Obtenemos el proximo nro de pedido a insertar
            pedido.id = await ObtenerUltimoPedido(connection);

            //Iniciamos una transaccion
            await connection.beginTransaction();

            //Insertamos la venta
            await InsertPedido(connection, pedido);

            //Insertamos los detalles de la venta
            for (const element of  pedido.detalles!) {
                element.idPedido = pedido.id;
                InsertDetallePedido(connection, element);
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

    async Modificar(pedido:Pedido): Promise<string>{
        const connection = await db.getConnection();
        
        try {
            //Iniciamos una transaccion
            await connection.beginTransaction();

            //Insertamos la venta
            await UpdatePedido(connection, pedido);

            //Eliminamos los detalles del pedido
            await connection.query("DELETE FROM pedidos_detalle WHERE idPedido = ?", [pedido.id]);

            //Insertamos los detalles del pedido
            for (const element of  pedido.detalles!) {
                element.idPedido = pedido.id;
                InsertDetallePedido(connection, element);
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

    async Finalizar(pedido:Pedido): Promise<string>{
        const connection = await db.getConnection();
        console.log(pedido)
        try {
            //Iniciamos una transaccion
            await connection.beginTransaction();

            //Actualizamos el estado del pedido
            await connection.query("UPDATE pedidos SET finalizado = ? WHERE id = ?", [pedido.finalizado, pedido.id]);

            //Si esta finalizando agregamos los detalles del pago
            if(pedido.pago && pedido.finalizado == 1){
                pedido.pago.idPedido = pedido.id;
                InsertPagoPedido(connection, pedido.pago)
            }else{
                await connection.query("DELETE FROM pedidos_pago WHERE idPedido = ?", [pedido.id]);
            }

            //Guardamos datos de facturacion
            if(pedido.factura?.cae && pedido.finalizado == 1){
                pedido.factura.idPedido = pedido.id;
                InsertFacturaPedido(connection, pedido.factura);
            }  
            
            //Actualizamos inventario
            for (const element of  pedido.detalles!) {
                const signo = pedido.finalizado ? "-" : "+";

                if(element.tipoProdVar == "Producto")
                    ActualizarInventario(connection, element, signo)
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

    async Eliminar(id:string): Promise<string>{
        const connection = await db.getConnection();
        
        try {
            await connection.query("UPDATE pedidos SET fechaBaja = ? WHERE id = ?", [new Date(), id]);
            return "OK";

        } catch (error:any) {
            throw error;
        } finally{
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
async function ObtenerUltimoPedido(connection):Promise<number>{
    try {
        const rows = await connection.query(" SELECT id FROM pedidos ORDER BY id DESC LIMIT 1 ");
        let resultado:number = 0;

        if([rows][0][0].length==0){
            resultado = 1;
        }else{
            resultado = rows[0][0].id + 1;
        }

        return resultado;

    } catch (error) {
        throw error; 
    }
}
async function InsertPedido(connection, pedido):Promise<void>{
    try {
       const consulta = " INSERT INTO pedidos(idTipo,idResponsable,cliente,idMesa,fecha,hora,total,obs,finalizado) " +
                        " VALUES(?,?,?,?,?,?,?,?,?) ";

        const parametros = [pedido.tipoPedido.id, pedido.responsable.id, pedido.cliente, pedido.mesa.id, moment(pedido.fecha).format('YYYY-MM-DD'), pedido.hora, pedido.total, pedido.obs, 0];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}
async function InsertPagoPedido(connection, pago):Promise<void>{
    try {
        const consulta = " INSERT INTO pedidos_pago(idPedido, idPago, efectivo, digital, recargo, descuento, realizado) " +
                         " VALUES(?, ?, ?, ?, ?, ?, ?) ";

        const parametros = [pago.idPedido, pago.tipoPago.id, pago.efectivo, pago.digital, pago.recargo, pago.descuento, pago.realizado];
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
                            idtipo = ?,
                            idResponsable = ?,
                            cliente = ?,
                            idMesa = ?,
                            fecha = ?,
                            hora = ?,
                            total = ?,
                            obs = ?
                          WHERE id = ?`;
                              

        const parametros = [pedido.tipoPedido.id,pedido.responsable.id, pedido.cliente, pedido.mesa.id, moment(pedido.fecha).format('YYYY-MM-DD'), pedido.hora, pedido.total, pedido.obs, pedido.id];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}
//#endregion

//#region DETALLE VENTA
async function ObtenerDetallePedido(connection, idVenta:number){
    try {
        const consulta = " SELECT pd.* FROM pedidos_detalle pd " +
                         " WHERE pd.idPedido = ?";

        const [rows] = await connection.query(consulta, [idVenta]);

        const detalles:DetallePedido[] = [];

        if (Array.isArray(rows)) {
            for (let i = 0; i < rows.length; i++) { 
                const row = rows[i];
                
                let detalle:DetallePedido = new DetallePedido();
                detalle.id = row['id'];
                detalle.idPedido = row['idPedido'];
                detalle.cantidad = row['cantidad'];
                detalle.unitario = parseFloat(row['unitario']);
                detalle.total = parseFloat(row['total']);
                detalle.productoVariedad = row['prodVar'];
                detalle.tipoProdVar = row['tipoProdVar'];
                detalle.idProdVar = row['idProdVar'];
                detalle.obs = row['obs'];
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
        const consulta = " INSERT INTO pedidos_detalle(idPedido, idProdVar, prodVar, tipoProdVar, cantidad, unitario, total, obs) " +
                         " VALUES(?, ?, ?, ?, ?, ?, ?, ?) ";

        const parametros = [detalle.idPedido, detalle.idProdVar, detalle.productoVariedad, detalle.tipoProdVar, detalle.cantidad, detalle.unitario, detalle.total, detalle.obs];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}

async function ActualizarInventario(connection, detalle, operacion):Promise<void>{
    try {
        const consulta = `UPDATE producto_variedad SET cantidad = cantidad ${operacion} ? 
                          WHERE id = ?`;

        const parametros = [detalle.cantidad, detalle.idProdVar];
        await connection.query(consulta, parametros);
        
    } catch (error) {
        throw error; 
    }
}
//#endregion

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
            filtro += " AND nombre LIKE '%"+ filtros.busqueda + "%' ";

        if (filtros.idPedido != 0 && filtros.idPedido != null)
        {
            filtro += " AND p.id = " + filtros.idPedido;
        }
        else
        {   
            if (filtros.tipoPedido != 0) { filtro += " AND p.idTipo = " + filtros.tipoPedido; }
            if (filtros.responsable != 0) { filtro += " AND p.idResponsable = " + filtros.responsable; }
            if (filtros.cliente != null) { filtro += " AND p.cliente LIKE '%" + filtros.cliente + "%' "; }

            if (filtros.fecha != null) { filtro += " AND p.fecha = '" + moment(filtros.fecha).format('YYYY-MM-DD') + "' "; }

            filtro += (filtros.finalizado) ? " AND p.finalizado = 1 " : " AND p.finalizado = 0 ";
        }
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
        query = count +
                " SELECT p.*, " +
                " tp.nombre tipo, COALESCE(u.nombre, 'ELIMINADO') responsable, COALESCE(m.codigo, 'ELIMINADA') codigoMesa, " + //Varios
                " tpag.id idTipoPago, tpag.nombre tipoPago, pp.realizado, pp.efectivo, pp.digital, pp.recargo, pp.descuento, " + //Pago
                " pfac.cae, pfac.caeVto, pfac.ticket, pfac.tipoFactura, pfac.neto, pfac.iva, pfac.dni, pfac.tipoDni, pfac.ptoVenta " + //Factura
                " FROM pedidos p " +
                " LEFT JOIN pedidos_tipo tp ON tp.id = p.idTipo " +
                " LEFT JOIN usuarios u ON u.id = p.idResponsable " +
                " LEFT JOIN mesas m ON m.id = p.idMesa " +
                " LEFT JOIN pedidos_pago pp ON pp.idPedido = p.id " +
                " LEFT JOIN tipos_pago tpag ON tpag.id = pp.idPago " +
                " LEFT JOIN pedidos_factura pfac ON pfac.idPedido = p.id " +
                " WHERE fechaBaja IS NULL " +
                filtro +
                " ORDER BY p.id DESC " +
                paginado +
                endCount;

        return query;
            
    } catch (error) {
        throw error; 
    }
}

export const PedidosRepo = new PedidosRepository();