import path from "path";
import { ObjComanda } from "../models/ObjComanda";
import { Pedido } from "../models/Pedido";
import PdfPrinter from 'pdfmake';
import { ObjResumen } from "../models/ObjResumen";
import moment from "moment";
import { TipoPago } from "../models/TipoPago";

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
        resumen.margenDer = parametrosImpresion.margenDer;
        resumen.margenIzq = parametrosImpresion.margenIzq;
        
        resumen.filasTabla = [
            [
                { text: 'M', style: 'tableHeader', alignment: 'center' },
                { text: 'Total', style: 'tableHeader', alignment: 'left' },
                { text: 'TP', style: 'tableHeader', alignment: 'center' }
            ]
        ];

        const FormatearTipoPago = (tipoPago) => {
            switch (tipoPago) {
                case "EFECTIVO":
                    return "EFE";
                case "TRANSFERENCIA":
                    return "TRA";
                case "TARJETA":
                    return "TAR";
                case "QR":
                    return "QR";
                default:
                    break;
            }
        };
        
        resumen.detalles!.forEach(item => {
            resumen.filasTabla?.push([
                item.numero,
                "$" + parseFloat(item.total).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                FormatearTipoPago(item.tipoPago)
            ]);
        });

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

    //#region TIPOS DE COMANDA
    private ArmarResumen58(resumen:ObjResumen){
        return {
            pageSize: {
                width: 140,
                height: 800,
            },
            pageMargins: [resumen.margenIzq, 0, resumen.margenDer, 0],
            content: [

                { text: "Resumen de Caja", alignment:"center", style:'titulo' },
                { text: moment(resumen.fecha).format('DD-MM-YY') + " " +  resumen.hora, alignment:"center", style:'fecha' },

                ...((resumen.mozo == 'TODOS') ? [ 
                    
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
                ] : [
                    { text: resumen.mozo, alignment:"center", style:'usuario' },
                ]),

                

                { text: "Métodos de pago", alignment:"center", style:'subtitulo' },
                {
                text: [
                    { text: 'Efectivo: '},
                    { text: resumen.efectivo!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Transferencia: '},
                    { text: resumen.transferencia!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'QR: '},
                    { text: resumen.qr!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Tarjeta: '},
                    { text: resumen.tarjetas!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Resto Comb: '},
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

                ...((resumen.mozo != 'TODOS') ? [ 
                    
                    {
                        table: {
                            widths: ['auto', '*', 'auto'],
                            body: resumen.filasTabla
                        },
                        layout: {
                            fillColor: function (rowIndex, node, columnIndex) {
                                return rowIndex === 0 ? '#CCCCCC' : null;
                            },
                            hLineWidth: function (i, node) {
                            // Línea después del header (i == 1) y después de la última fila (i == node.table.body.length)
                            return (i === 1 || i === node.table.body.length) ? 1 : 0;
                            },
                            vLineWidth: function (i, node) {
                            return 0;
                            },
                            hLineColor: function (i, node) {
                            return i === 1 ? 'black' : '#CCCCCC';
                            },
                            paddingTop: function (i, node) { return 2; },
                            paddingBottom: function (i, node) { return 2; },
                        },
                        style: 'tableStyle' // Aplicar el estilo a la tabla
                    },
                ] : []),
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
                tableStyle: {
                fontSize: 10, // Cambiar el tamaño de letra de la tabla
                margin: [0, 5, 0, 3]
                }
            }
        };
    }

    private ArmarResumen80(resumen:ObjResumen){
        return {
            pageSize: {
                width: 200,
                height: 800,
            },
            pageMargins: [resumen.margenIzq, 0, resumen.margenDer, 0],
            content: [
                { text: "Resumen de Caja", alignment:"center", style:'titulo' },
                { text: moment(resumen.fecha).format('DD-MM-YY') + " " +  resumen.hora, alignment:"center", style:'fecha' },

                ...((resumen.mozo == 'TODOS') ? [ 
                    
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
                ] : [
                    { text: resumen.mozo, alignment:"center", style:'usuario' },
                ]),

                { text: "Métodos de pago", alignment:"center", style:'subtitulo' },
                {
                text: [
                    { text: 'Efectivo: '},
                    { text: resumen.efectivo!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Transferencia: '},
                    { text: resumen.transferencia!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'QR: '},
                    { text: resumen.qr!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Tarjeta: '},
                    { text: resumen.tarjetas!.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                ],
                style: 'datos'
                },
                {
                text: [
                    { text: 'Resto Comb: '},
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

                ...((resumen.mozo != 'TODOS') ? [ 
                    
                    {
                        table: {
                            widths: ['auto', '*', 'auto'],
                            body: resumen.filasTabla
                        },
                        layout: {
                            fillColor: function (rowIndex, node, columnIndex) {
                                return rowIndex === 0 ? '#CCCCCC' : null;
                            },
                            hLineWidth: function (i, node) {
                            // Línea después del header (i == 1) y después de la última fila (i == node.table.body.length)
                            return (i === 1 || i === node.table.body.length) ? 1 : 0;
                            },
                            vLineWidth: function (i, node) {
                            return 0;
                            },
                            hLineColor: function (i, node) {
                            return i === 1 ? 'black' : '#CCCCCC';
                            },
                            paddingTop: function (i, node) { return 2; },
                            paddingBottom: function (i, node) { return 2; },
                        },
                        style: 'tableStyle' // Aplicar el estilo a la tabla
                    },
                ] : []),
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
                tableStyle: {
                fontSize: 11, // Cambiar el tamaño de letra de la tabla
                margin: [0, 5, 0, 3]
                }
            }
        };
    }
}

export default new ResumenService();
