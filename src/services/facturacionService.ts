import logger from "../log/logger";
import { AppError } from "../log/AppError";
import { CodigoError } from "../log/CodigosError";
import {ParametrosRepo} from '../data/parametrosRepository';
import { Afip } from "afip.ts";
import fs from "fs";
import path from "path";
import { ObjFacturar } from "../models/ObjFacturar";
import config from '../conf/app.config';
import moment from "moment";
import { PedidosRepo } from "../data/pedidosRepository";
import { ValidarConsistenciaFiscal } from "../utils/datosFiscales";
const QRCode = require('qrcode');

class FacturacionService{

    async Facturar(objFactura:ObjFacturar){

        //Chequeo defensivo: la condición IVA del receptor manda sobre el documento exigido.
        //El frontend ya valida esto, pero no confiamos en eso antes de llamar a ARCA.
        const errorFiscal = ValidarConsistenciaFiscal({
            condicionIva: objFactura.condReceptor,
            tipoDocumento: objFactura.docTipo,
            nroDocumento: objFactura.docNro
        });
        if (errorFiscal) {
            throw new AppError(CodigoError.VALIDACION, errorFiscal, 400);
        }

        const datosFacturacion = await ParametrosRepo.ObtenerParametrosFacturacion();
        const afip = await getAfipInstance(datosFacturacion.cuil);

        //Verificamos el estado del servidor
        const serverStatus = await afip.electronicBillingService.getServerStatus();
        if (
            !serverStatus ||
            serverStatus.FEDummyResult.AppServer !== 'OK' ||
            serverStatus.FEDummyResult.DbServer !== 'OK' ||
            serverStatus.FEDummyResult.AuthServer !== 'OK'
        ) {
            throw new AppError(
                CodigoError.AFIP_NO_DISPONIBLE,
                'Servicio de ARCA no disponible.',
                503
            );
        }

        //Tipos de comprobante
        // 1 → Factura A
        // 6 → Factura B
        // 11 → Factura C

        // Tipos de IVA
        // 3 → 0%
        // 4 → 10,5%
        // 5 → 21%
        // 6 → 27%

        // NC/ND (notas de credito/debito) no estan implementadas todavia. Si se agregan,
        // ver EasySalesApi/facturacionService.ts (campo comprobanteAsociado -> CbtesAsoc).

        const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        // Factura A discrimina IVA
        // Factura B no discrimina IVA pero es necesario pasar el IVA incluido en ImpIVA
        // Factura C no necesita de IVA en ningun sentido, neto será igual al total
        let neto = 0;
        let iva = 0;

        if(objFactura.tipoFactura === 1 || objFactura.tipoFactura === 6){
            neto = Math.round((objFactura.total! / 1.21) * 100) / 100;
            iva = Math.round((objFactura.total! - neto) * 100) / 100;
        }else{
            neto = objFactura.total!;
        }

        let data : any = {
            CantReg: 1, // Cantidad de comprobantes a registrar
            PtoVta: datosFacturacion.puntoVta, // Punto de venta
            CbteTipo: objFactura.tipoFactura, // Tipo de comprobante (ver tipos disponibles)
            Concepto: 1, // Concepto del Comprobante: (1)Productos, (2)Servicios, (3)Productos y Servicios
            DocTipo: objFactura.docTipo, // Tipo de documento del comprador (99 consumidor final, ver tipos disponibles)
            DocNro: objFactura.docNro, // Número de documento del comprador (0 consumidor final)
            CbteDesde: 1, // Número de comprobante o numero del primer comprobante en caso de ser mas de uno
            CbteHasta: 1, // Número de comprobante o numero del último comprobante en caso de ser mas de uno
            CbteFch: date.replace(/-/g, ""), // (Opcional) Fecha del comprobante (yyyymmdd) o fecha actual si es nulo
            ImpTotal: objFactura.total, // Importe total del comprobante
            ImpTotConc: 0, // Importe neto no gravado
            ImpNeto: neto, // Importe neto gravado
            ImpOpEx: 0, // Importe exento de IVA
            ImpIVA: iva, //Importe total de IVA
            CondicionIVAReceptorId: objFactura.condReceptor ?? 5, //Condicion frente al iva del receptor (5=Consumidor Final por defecto)
            ImpTrib: 0, //Importe total de tributos
            MonId: "PES", //Tipo de moneda usada en el comprobante (ver tipos disponibles)('PES' para pesos argentinos)
            MonCotiz: 1, // Cotización de la moneda usada (1 para pesos argentinos)
        };

        // Solo agregamos el campo `Iva` si es una Factura A o B
        if (objFactura.tipoFactura === 1 || objFactura.tipoFactura === 6) {
            data.Iva = [
            {
                Id: 5, // 21%
                BaseImp: neto,
                Importe: iva
            }
            ];
        }

        let res;
        try {
            res = await afip.electronicBillingService.createNextVoucher(data);
        } catch (err: any) {
            if (err?.code === 'ECONNRESET' || err?.message?.includes('socket')) {
                throw new AppError(
                    CodigoError.AFIP_TIMEOUT, 'ARCA no respondió (timeout)', 504,
                    { modulo: 'FacturacionService', metodo: 'createNextVoucher' },
                    err
                );
            } else {
                throw new AppError(
                    CodigoError.AFIP_ERROR, 'Ocurrió un error al intentar generar el comprobante', 500,
                    { modulo: 'FacturacionService', metodo: 'createNextVoucher' },
                    err
                );
            }
        }

        //Detalle de la respuesta
        const detalle = res.response?.FeDetResp?.FECAEDetResponse?.[0];

        //COMPROBANTE APROBADO
        if (detalle?.Resultado === "A") {
            const lastVoucher = await afip.electronicBillingService.getLastVoucher(datosFacturacion.puntoVta, objFactura.tipoFactura!); //Obtenemos el nro del ultimo comprobante creado

            return {
                estado: "Aprobado",
                cae: detalle.CAE,
                caeVto:  moment(detalle.CAEFchVto, "YYYYMMDD"),
                ticket: lastVoucher.CbteNro,
                ptoVenta: datosFacturacion.puntoVta,
                neto,
                iva
            };
        }

        //COMPROBANTE RECHAZADO
        const observacionesAfip = detalle?.Observaciones?.Obs ?? [];
        const erroresAfip = res.response?.Errors?.Err ?? [];

        const mensajes: string[] = [
            ...observacionesAfip.map((o: any) => `OBS ${o.Code}: ${o.Msg}`),
            ...erroresAfip.map((e: any) => `ERR ${e.Code}: ${e.Msg}`)
        ];

        if (mensajes.length === 0) {
            mensajes.push('ARCA rechazó el comprobante sin detalles');
        }

        //logeamos mensajes por separado
        mensajes.forEach(m => logger.error({ code: CodigoError.AFIP_RECHAZO, message: m, modulo: 'facturacionService.Facturar' }));

        //Devolvemos y logeamos error tecnico
        throw new AppError(
            CodigoError.AFIP_RECHAZO, 'El comprobante fue rechazado por ARCA', 422,
            {
                modulo: 'FacturacionService',
                metodo: 'createNextVoucher',
                detallesAfip: mensajes,
                resultadoAfip: detalle?.Resultado
            }
        );
    }

    async ObtenerQRFactura(idVenta){
        try {

            let datosQR = await PedidosRepo.ObtenerQRFactura(idVenta);
            const datosFacturacion = await ParametrosRepo.ObtenerParametrosFacturacion();

            if(datosQR){
                datosQR.cuit = datosFacturacion.cuil;

                const jsonBase64 = Buffer.from(JSON.stringify(datosQR)).toString('base64');
                const url = `https://www.arca.gob.ar/fe/qr/?p=${jsonBase64}`;

                return await QRCode.toDataURL(url);
            }
          
            return null;

        } catch (error) {
            throw new AppError(
                CodigoError.AFIP_ERROR,
                'No se pudo generar el QR de la factura.', 500,
                { modulo: 'FacturacionService', metodo: 'ObtenerQRFactura' },
                error
            );
        }
    }
}


async function getAfipInstance(cuilTitular): Promise<Afip> {
    //Verificamos el cuit del titular
    if(!cuilTitular || cuilTitular=="") throw new AppError(CodigoError.CERTIFICADOS, `No se encontró en la base de datos CUIL válido.`, 400);

    //Verificamos que existan los archivos de clave y certificado
    let cert: string, key: string;
    try {
        cert = fs.readFileSync(path.resolve(__dirname, '../certs/', "cert"), "utf8");
        key = fs.readFileSync(path.resolve(__dirname, '../certs/', "key"), "utf8");
    } catch (err) {
        throw new AppError(CodigoError.CERTIFICADOS, `No se encontraron los archivos de certificado/clave.`, 400, { modulo: 'facturacionService.getAfipInstance' }, err);
    }

    if(key.trim().length === 0) throw new AppError(CodigoError.CERTIFICADOS, `No se encontró archivo key.`, 400);
    if(cert.trim().length === 0) throw new AppError(CodigoError.CERTIFICADOS, `No se encontró archivo cert.`, 400);

    const afip = new Afip({
        key: key,
        cert: cert,
        cuit: cuilTitular,
        production: config.produccion
    });

    return afip;
}

export const FacturacionServ = new FacturacionService();
