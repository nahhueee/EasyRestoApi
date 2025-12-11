import moment from 'moment';
import db from '../db/db.config';
import { FiltroEstadistica } from '../models/FiltroEstadistica';

class EstadisticasRepository{

    async TotalesCantGenerales(filtros:FiltroEstadistica){
        const connection = await db.getConnection();
        
        try {
            const { fechaDesde, fechaHasta } = obtenerRangosFecha(filtros);

            //#region CONSULTAS
            const consulta1 = " SELECT COUNT(*) AS cantidad_pedidos,  SUM(total) AS total_pedidos FROM pedidos " +
                              " WHERE (fecha BETWEEN ? AND ?) AND fechaBaja IS NULL AND finalizado = 1 ";
            
            const [consultaTotalesPedido] = await connection.query(consulta1, [fechaDesde, fechaHasta]);

            const consulta2 = " SELECT COUNT(*) AS cantidad_facturas, SUM(p.total) AS total_facturas " +
                              " FROM pedidos_factura pf " +
                              " INNER JOIN pedidos p ON p.id = pf.idPedido " +
                              " WHERE (p.fecha BETWEEN ? AND ?) AND fechaBaja IS NULL AND finalizado = 1";
            
            const [consultaTotalesFactura] = await connection.query(consulta2, [fechaDesde, fechaHasta]);
            //#endregion

            const resultados = {
                cantidad_pedidos: consultaTotalesPedido[0].cantidad_pedidos || 0,
                total_pedidos: consultaTotalesPedido[0].total_pedidos || 0,
                cantidad_facturas: consultaTotalesFactura[0].cantidad_facturas || 0,
                total_facturas: consultaTotalesFactura[0].total_facturas || 0,
            };

            return resultados;


        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async TotalesXTipoPago(filtros:FiltroEstadistica){
        const connection = await db.getConnection();
        
        try {
            const { fechaDesde, fechaHasta } = obtenerRangosFecha(filtros);
            const adicional = filtros.caja && filtros.caja != 0 ? " AND p.idCaja = " + filtros.caja : " AND (p.fecha BETWEEN ? AND ?) ";

            //#region CONSULTAS
            const consultaTotales =  " SELECT  " +
                                     " COALESCE(SUM(CASE WHEN ppag.idTPago = 1 THEN efectivo ELSE 0 END), 0) AS efectivo, " +
                                     " COALESCE(SUM(CASE WHEN ppag.idTPago = 2 THEN digital ELSE 0 END), 0) AS tarjetas, " +
                                     " COALESCE(SUM(CASE WHEN ppag.idTPago = 3 THEN digital ELSE 0 END), 0) AS transferencias, " +
                                     " COALESCE(SUM(CASE WHEN ppag.idTPago = 4 THEN digital ELSE 0 END), 0) AS otros " +
                                     " FROM pedidos_pago ppag " +
                                     " INNER JOIN pedidos p ON p.id = ppag.idPedido " +
                                     " WHERE p.fechaBaja IS NULL AND ppag.realizado = 1 " +
                                     adicional;


            const [resultTotales] = await connection.query(consultaTotales, [fechaDesde, fechaHasta]);

            const consultaCantidad = " SELECT  " +
                                     " SUM(CASE WHEN ppag.idTPago = 1 THEN 1 ELSE 0 END) AS cant_efectivo, " +
                                     " SUM(CASE WHEN ppag.idTPago = 2 THEN 1 ELSE 0 END) AS cant_tarjetas, " +
                                     " SUM(CASE WHEN ppag.idTPago = 3 THEN 1 ELSE 0 END) AS cant_transferencias, " +
                                     " SUM(CASE WHEN ppag.idTPago = 4 THEN 1 ELSE 0 END) AS cant_otros " +
                                     " FROM pedidos_pago ppag " +
                                     " INNER JOIN pedidos p ON p.id = ppag.idPedido " +
                                     " WHERE p.fechaBaja IS NULL AND ppag.realizado = 1 " +
                                     adicional;

            const [resultCantidad] = await connection.query(consultaCantidad, [fechaDesde, fechaHasta]);
            //#endregion

            return {
                total_efectivo: parseFloat(resultTotales[0].efectivo),
                total_tarjetas: parseFloat(resultTotales[0].tarjetas),
                total_transferencias: parseFloat(resultTotales[0].transferencias),
                total_otros: parseFloat(resultTotales[0].otros),

                cantidad_efectivo:resultCantidad[0].cant_efectivo,
                cantidad_tarjetas:resultCantidad[0].cant_tarjetas,
                cantidad_transferencias:resultCantidad[0].cant_transferencias,
                cantidad_otros:resultCantidad[0].cant_otros,
            };

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async TotalesXTipoPedido(filtros:FiltroEstadistica){
        const connection = await db.getConnection();
        
        try {
            const { fechaDesde, fechaHasta } = obtenerRangosFecha(filtros);

            //#region CONSULTAS
            const consultaCantidad = " SELECT  " +
                                     " SUM(CASE WHEN idTipo = 1 THEN 1 ELSE 0 END) AS cant_restaurant, " +
                                     " SUM(CASE WHEN idTipo = 2 THEN 1 ELSE 0 END) AS cant_retira, " +
                                     " SUM(CASE WHEN idTipo = 3 THEN 1 ELSE 0 END) AS cant_delivery " +
                                     " FROM pedidos " +
                                     " WHERE (fecha BETWEEN ? AND ?) AND fechaBaja IS NULL AND finalizado = 1 ";

            const [resultCantidad] = await connection.query(consultaCantidad, [fechaDesde, fechaHasta]);
            //#endregion

            return {
                cantidad_restaurant:resultCantidad[0].cant_restaurant,
                cantidad_retira:resultCantidad[0].cant_retira,
                cantidad_delivery:resultCantidad[0].cant_delivery
            };

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async ProductosPopulares(filtros:FiltroEstadistica){
        const connection = await db.getConnection();
        
        try {
            const { fechaDesde, fechaHasta } = obtenerRangosFecha(filtros);

            const consulta = " SELECT SUM(pd.cantidad) EjeY, pro.nombre EjeX  " +
                             " FROM pedidos_detalle pd" +
                             " INNER JOIN productos pro ON pro.id = pd.idProducto" +
                             " INNER JOIN pedidos p on pd.idPedido = p.id " +
                             " WHERE (p.fecha BETWEEN ? AND ?) AND p.fechaBaja IS NULL AND p.finalizado = 1" + 
                             " GROUP BY pd.idProducto" +
                             " ORDER BY EjeY DESC " +
                             " LIMIT 5;";

            const [rows] = await connection.query(consulta, [fechaDesde, fechaHasta]);
            return await TransformarDatos([rows][0]);

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }

    async GananciasComparativas(filtros:FiltroEstadistica){
        const connection = await db.getConnection();
        
        try {
            
            let { fechaDesde, fechaHasta } = obtenerRangosFecha(filtros);

            let groupBy = "DATE_FORMAT(p.fecha, '%d-%m-%y')";
            let orderBy = "MIN(p.fecha)";
            let limit = 7;

            if (filtros.rango === 'anio') {
                groupBy = "DATE_FORMAT(p.fecha, '%M-%y')"; 
                orderBy = "MIN(p.fecha)";
                limit = 12;
            } else if (filtros.rango === 'mes') {
                groupBy = "CONCAT('Semana ', WEEK(p.fecha, 1))";
                orderBy = "MIN(p.fecha)";
                limit = 5;
            } else if (filtros.rango === 'hoy') {
                fechaDesde = moment().subtract(5, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
                limit = 5;
            }

            const consulta = `
                SELECT 
                ${groupBy} AS EjeX,
                SUM((pd.unitario - pd.costo) * pd.cantidad) AS EjeY
                FROM pedidos_detalle pd
                INNER JOIN pedidos p ON pd.idPedido = p.id
                WHERE p.fecha BETWEEN ? AND ?
                AND p.fechaBaja IS NULL
                AND p.finalizado = 1
                GROUP BY EjeX
                ORDER BY ${orderBy} ASC
                LIMIT ${limit};
            `;

            const [rows] = await connection.query(consulta, [fechaDesde, fechaHasta]);
            return await TransformarDatos([rows][0]);

        } catch (error:any) {
            throw error;
        } finally{
            connection.release();
        }
    }
}

async function TransformarDatos(inputArray:any){
    try {
        const ejeX: number[] = [];
        const ejeY: number[] = [];

        // Iteramos sobre cada elemento del array de entrada
        inputArray.forEach(item => {
            // Agregamos el primer elemento al array de ejeY
            ejeY.push(item.EjeY);
            // Agregamos el segundo elemento al array de ejeX
            ejeX.push(item.EjeX);
        });

        // Devolvemos un objeto con los dos arrays
        return { ejeY, ejeX };
    } catch (error) {
        throw error; 
    }
}

function obtenerRangosFecha(filtro:FiltroEstadistica){
  const today = new Date();
  let fechaDesde, fechaHasta;

  switch (filtro.rango) {
    case 'hoy':
      fechaDesde = moment().startOf('day');
      fechaHasta = moment().endOf('day');
      break;

    case 'semana':
      fechaDesde = moment().startOf('week'); 
      fechaHasta = moment().endOf('day'); 
      break;

    case 'mes':
      fechaDesde = moment().startOf('month');
      fechaHasta = moment().endOf('day');
      break;

    case 'anio':
      fechaDesde = moment().startOf('year');
      fechaHasta = moment().endOf('day');
      break;

    case 'personalizado':
      fechaDesde = moment(filtro.inicio).startOf('day');
      fechaHasta = moment(filtro.fin).endOf('day');
      break;

    default:
      throw new Error('Rango inválido');
  }

  return {
    fechaDesde: fechaDesde.format('YYYY-MM-DD HH:mm:ss'),
    fechaHasta: fechaHasta.format('YYYY-MM-DD HH:mm:ss'),
  };
};


export const EstadisticasRepo = new EstadisticasRepository();