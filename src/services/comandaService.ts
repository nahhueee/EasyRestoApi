import path from "path";
import { ObjComanda } from "../models/ObjComanda";
import { Pedido } from "../models/Pedido";
import PdfPrinter from 'pdfmake';

const fonts = {
  Roboto: {
    normal: path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, '../fonts/Roboto-Medium.ttf'),
    italics: path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '../fonts/Roboto-MediumItalic.ttf')
  }
};

const printer = new PdfPrinter(fonts);

class ComandaService {
    async GenerarComandaPDF(pedido, parametrosImpresion) {
        const comanda = this.GenerarDatosComunes(pedido);

        comanda.papel = parametrosImpresion.papel;
        comanda.margenDer = parametrosImpresion.margenDer;
        comanda.margenIzq = parametrosImpresion.margenIzq;

        const docDefinition = comanda.papel === '58mm'
            ? this.ArmarComanda58(comanda)
            : this.ArmarComanda80(comanda);

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
    private ArmarComanda58(comanda:ObjComanda){
        return {
        pageSize: {
            width: 140,
            height: 800,
            pageOrientation: 'portrait',
        },
        pageMargins: [comanda.margenIzq, 0, comanda.margenDer, 0],
        content: [
            { text: comanda.fechaPedido + " " +  comanda.horaPedido, alignment:"center", style:'fecha' },

            {
            text: [
                { text: 'Nro: ', bold: true },
                { text: comanda.nroPedido }
            ],
            style: 'datos'
            },
            {
            text: [
                { text: 'Mesa: ', bold: true },
                { text: comanda.mesa }
            ],
            style: 'datos'
            },
            {
            text: [
                { text: 'Mozo: ', bold: true },
                { text: comanda.mozo }
            ],
            style: 'datos'
            },

            {
            text: [
                { text: '* ', bold: true },
                { text: comanda.observacion }
            ],
            style: 'observacion'
            },

            {
            table: {
                widths: ['auto', '*'],
                body: comanda.filasTabla
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
            
        ],
        styles: {
            titulo: {
            fontSize: 10,
            bold: true,
            margin: [0, 0, 0, 2]
            },
            fecha: {
            fontSize: 10, 
            margin: [0, 0, 0, 5]
            },
            datos: {
            fontSize: 10,
            margin: [3, 0, 0, 0]
            },
            observacion: {
            fontSize: 10,
            bold: false,
            margin: [3, 5, 0, 5]
            },
            tableStyle: {
            fontSize: 9, // Cambiar el tamaño de letra de la tabla
            margin: [0, 0, 0, 3]
            }
        }
        };
    }

    private ArmarComanda80(comanda:ObjComanda){
        return {
        pageSize: {
            width: 227, 
            height: 800,
        },
        pageMargins: [comanda.margenIzq, 0, comanda.margenDer, 0],
        content: [
            { text: comanda.fechaPedido + " " +  comanda.horaPedido, alignment:"center", style:'fecha' },

            {
            text: [
                { text: 'Nro: ', bold: true },
                { text: comanda.nroPedido }
            ],
            style: 'datos'
            },
            {
            text: [
                { text: 'Mesa: ', bold: true },
                { text: comanda.mesa }
            ],
            style: 'datos'
            },
            {
            text: [
                { text: 'Mozo: ', bold: true },
                { text: comanda.mozo }
            ],
            style: 'datos'
            },

            {
            text: [
                { text: '* ', bold: true },
                { text: comanda.observacion }
            ],
            style: 'observacion'
            },

            {
            table: {
                widths: ['auto', '*'],
                body: comanda.filasTabla
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
            
        ],
        styles: {
            titulo: {
            fontSize: 10,
            bold: true,
            margin: [0, 0, 0, 2]
            },
            fecha: {
            fontSize: 12, 
            margin: [0, 0, 0, 5]
            },
            datos: {
            fontSize: 13,
            margin: [3, 0, 0, 0]
            },
            observacion: {
            fontSize: 12,
            bold: false,
            margin: [3, 5, 0, 5]
            },
            tableStyle: {
            fontSize: 11, // Cambiar el tamaño de letra de la tabla
            margin: [0, 0, 0, 3]
            }
        }
    };
  }
}

export default new ComandaService();
