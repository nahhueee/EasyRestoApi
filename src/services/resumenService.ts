import path from "path";
import { ObjComanda } from "../models/ObjComanda";
import { Pedido } from "../models/Pedido";
import PdfPrinter from 'pdfmake';
import { ObjResumen } from "../models/ObjResumen";
import moment from "moment";

const fonts = {
  Roboto: {
    normal: path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, '../fonts/Roboto-Medium.ttf'),
    italics: path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '../fonts/Roboto-MediumItalic.ttf')
  }
};

const printer = new PdfPrinter(fonts);

class ResumenService {
    async GenerarResumenPDF(resumen:ObjResumen, parametrosImpresion) {
        resumen.papel = parametrosImpresion.papel;
        
        const docDefinition = resumen.papel === '58mm'
            ? this.ArmarResumen58(resumen)
            : this.ArmarResumen80(resumen);

        return new Promise((resolve, reject) => {
            try {
                const chunks: Buffer[] = [];
                const pdfDoc = printer.createPdfKitDocument(docDefinition);

                pdfDoc.on('data', chunk => chunks.push(chunk));
                pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
                pdfDoc.on('error', reject);

                pdfDoc.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    //Genera los datos comunes del documento y la estructura de la tabla
    private GenerarDatosComunes(pedido:Pedido): ObjComanda {
        let comanda = new ObjComanda();

        comanda.nroPedido = pedido.id!;
        comanda.mesa = pedido.mesa?.codigo!;
        comanda.mozo = pedido.responsable?.nombre!;
        comanda.observacion = pedido.obs!;
        comanda.horaPedido = pedido.hora;
        const fecha = new Date(pedido.fecha!);
        comanda.fechaPedido = fecha.toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: '2-digit'
        });

        const FormatearCantidad = (cantidad) => {
        const cantNumero = parseFloat(cantidad);
        return cantNumero % 1 === 0 ? cantNumero.toFixed(0) : cantNumero.toFixed(1);
        };
        
        comanda.filasTabla = [
        [
            { text: 'C', style: 'tableHeader', alignment: 'left' },
            { text: 'Variedad', style: 'tableHeader', alignment: 'left' }
        ]
        ];

        pedido.detalles!.filter(item => item.tipoProd === 'elaborado')
        .forEach(item => {

        // Fila principal
        comanda.filasTabla?.push([
            FormatearCantidad(item.cantidad),
            item.producto,
        ]);

        // Fila de observación si existe
        if (item.obs && item.obs != "") {
            comanda.filasTabla?.push([
            {
                text: `*    ${item.obs}`,
                italics: true,
                fontSize: comanda.papel == "58mm" ? 9 : 11,
                colSpan: 2,
                margin: [1, -2, 0, 2],
                border: [false, false, false, false]
            },
            {} // Celda vacía requerida para completar el colSpan
            ]);
        }
        });

        return comanda;
    }

    //#region TIPOS DE COMANDA
    private ArmarResumen58(resumen:ObjResumen){
        return {
            pageSize: {
                width: 140,
                height: 800,
            },
            pageMargins: [1, 0, 1, 0],
            content: [
                { text: "Resumen de Caja", alignment:"center", style:'titulo' },

                { text: moment(resumen.fecha).format('DD-MM-YY') + " " +  resumen.hora, alignment:"center", style:'fecha' },
                { text: resumen.usuario, alignment:"center", style:'usuario' },

                {
                text: [
                    { text: 'Inicial: '},
                    { text: resumen.inicial!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Pedidos: '},
                    { text: resumen.pedidos!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Entradas: '},
                    { text: resumen.entradas!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Salidas: '},
                    { text: resumen.salidas!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Total: ', bold: true },
                    { text: resumen.total!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },

                { text: "Métodos de pago", alignment:"center", style:'subtitulo' },
                {
                text: [
                    { text: 'T Efectivo: '},
                    { text: resumen.efectivo!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'T Transferencia: '},
                    { text: resumen.transferencia!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'T Tarjeta: '},
                    { text: resumen.tarjetas!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'T Resto Comb: '},
                    { text: resumen.restoCombinado!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },


                {
                text: [
                    { text: 'Cant. Pedidos: '},
                    { text: resumen.cantPedidos }
                ],
                style: 'pie'
                },
                {
                text: [
                    { text: 'Impreso: '},
                    { text: moment().format('DD-MM-YY hh:mm') }
                ],
                style: 'datos'
                },
            ],
            styles: {
                titulo: {
                fontSize: 10,
                bold: true,
                margin: [0, 2, 0, 5]
                },
                subtitulo: {
                fontSize: 10,
                bold: true,
                margin: [0, 10, 0, 5]
                },
                fecha: {
                fontSize: 10, 
                margin: [0, 0, 0, 1]
                },
                usuario: {
                fontSize: 10, 
                margin: [0, 0, 0, 5]
                },
                datos: {
                fontSize: 10,
                margin: [3, 0, 0, 0]
                },
                pie: {
                fontSize: 10,
                margin: [3, 10, 0, 0]
                },
            }
        };
    }

    private ArmarResumen80(resumen:ObjResumen){
        return {
            pageSize: {
                width: 227,
                height: 800,
            },
            pageMargins: [1, 0, 1, 0],
            content: [
                { text: "Resumen de Caja", alignment:"center", style:'titulo' },

                { text: moment(resumen.fecha).format('DD-MM-YY') + " " +  resumen.hora, alignment:"center", style:'fecha' },
                { text: resumen.usuario, alignment:"center", style:'usuario' },

                {
                text: [
                    { text: 'Inicial: '},
                    { text: resumen.inicial!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Pedidos: '},
                    { text: resumen.pedidos!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Entradas: '},
                    { text: resumen.entradas!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Salidas: '},
                    { text: resumen.salidas!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Total: ', bold: true },
                    { text: resumen.total!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },

                { text: "Métodos de pago", alignment:"center", style:'subtitulo' },
                {
                text: [
                    { text: 'T Efectivo: '},
                    { text: resumen.efectivo!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'T Transferencia: '},
                    { text: resumen.transferencia!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'T Tarjeta: '},
                    { text: resumen.tarjetas!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'T Resto Comb: '},
                    { text: resumen.restoCombinado!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },


                {
                text: [
                    { text: 'Cant. Pedidos: '},
                    { text: resumen.cantPedidos }
                ],
                style: 'pie'
                },
                {
                text: [
                    { text: 'Impreso: '},
                    { text: moment().format('DD-MM-YY hh:mm') }
                ],
                style: 'datos'
                },
            ],
            styles: {
                titulo: {
                fontSize: 12,
                bold: true,
                margin: [0, 2, 0, 5]
                },
                subtitulo: {
                fontSize: 12,
                bold: true,
                margin: [0, 10, 0, 5]
                },
                fecha: {
                fontSize: 12, 
                margin: [0, 0, 0, 1]
                },
                usuario: {
                fontSize: 12, 
                margin: [0, 0, 0, 5]
                },
                datos: {
                fontSize: 12,
                margin: [3, 0, 0, 0]
                },
                pie: {
                fontSize: 12,
                margin: [3, 10, 0, 0]
                },
            }
        };
    }
}

export default new ResumenService();
