import path from "path";
import { ObjComanda } from "../models/ObjComanda";
import { Pedido } from "../models/Pedido";
import PdfPrinter from 'pdfmake';
import { prodRepository } from "../data/productosRepository";

const fonts = {
  Roboto: {
    normal: path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, '../fonts/Roboto-Medium.ttf'),
    italics: path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '../fonts/Roboto-MediumItalic.ttf')
  }
};

const printer = new PdfPrinter(fonts);

type DestinoComanda = 'principal' | 'barra' | 'ninguna';

export interface PlanComandas {
    principal: any[];
    barra: any[] | null; // null = no se imprime comanda de barra para este pedido
}

class ComandaService {
    // Reparte los ítems del pedido entre la comanda principal y la de barra.
    // El sector sale de la base (productos.sector), no del payload: así EasyRestoMobile
    // sin actualizar respeta lo configurado. Ver handoff_rework_productos_comandas.md, PR2 §2.4.
    async PlanificarComandas(pedido, parametrosImpresion): Promise<PlanComandas> {
        const detalles:any[] = (pedido.detalles ?? []).filter(item => item.quitado == false);

        const ids = [...new Set<number>(detalles.map(item => item.idProducto).filter(id => id != null))];
        const sectores = await prodRepository.ObtenerSectores(ids);

        const destinoBarra:DestinoComanda = parametrosImpresion.destinoBarra ?? 'ninguna';
        const destinoSinPrep:DestinoComanda = parametrosImpresion.destinoSinPrep ?? 'ninguna';
        const haySalidaBarra = destinoBarra === 'barra' || destinoSinPrep === 'barra';

        const principal:any[] = [];
        const barra:any[] = [];

        for (const item of detalles) {
            // Producto borrado físicamente: no está en la base, se cae al tipo que mandó el cliente
            const sector = sectores.get(item.idProducto) ?? (item.tipoProd === 'terciarizado' ? 'barra' : 'cocina');
            const destino:DestinoComanda = sector === 'cocina' ? 'principal'
                                         : sector === 'barra' ? destinoBarra
                                         : destinoSinPrep;

            //TODO
            //TEMPORAL - Buscar la forma de estandarizar esto con las promociones
            //(regla PROMO sin cambios: sale en la principal y, si existe comanda de barra, también en esa)
            const esPromo = item.producto?.includes("PROMO");

            if(destino === 'principal' || esPromo) principal.push(item);
            if(destino === 'barra' || (esPromo && haySalidaBarra)) barra.push(item);
        }

        return { principal, barra: barra.length > 0 ? barra : null };
    }

    // `detalles`: ya repartidos por PlanificarComandas para esta comanda.
    async GenerarComandaPDF(pedido, parametrosImpresion, detalles:any[], opciones:{ titulo?:string, tieneComandaBarra?:boolean } = {}): Promise<Buffer> {
        const comanda = this.GenerarDatosComunes(pedido, detalles, opciones);

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
    private GenerarDatosComunes(pedido:Pedido, detalles:any[], opciones:{ titulo?:string, tieneComandaBarra?:boolean }): ObjComanda {
        let comanda = new ObjComanda();

        comanda.nroPedido = pedido.id!;
        comanda.mesa = pedido.mesa?.codigo!;
        if(comanda.mesa == "NO SELECCIONADA") comanda.mesa = "";
        comanda.mozo = pedido.responsable?.nombre!;
        comanda.cliente = pedido.cliente!;
        comanda.tipoPedidoId = pedido.tipo?.id;
        comanda.tipoPedido = pedido.tipo?.nombre;
        comanda.observacion = pedido.obs!;
        comanda.horaPedido = pedido.hora;

        // Título (comanda de barra) y aviso en la principal: tieneComandaBarra solo es true si de verdad se imprime una comanda de barra
        comanda.titulo = opciones.titulo;
        comanda.tieneComandaBarra = opciones.tieneComandaBarra ?? false;

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

        detalles.forEach(item => {

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
        },
        pageMargins: [comanda.margenIzq, 0, comanda.margenDer, 0],
        content: [
            ...(comanda.titulo ? [
                { text: comanda.titulo, alignment: 'center', style: 'titulo' }
            ] : []),

            { text: comanda.fechaPedido + " " +  comanda.horaPedido, alignment:"center", style:'fecha' },

            ...(comanda.tipoPedidoId !== 1 ? [
                { text: (comanda.tipoPedido || '').toUpperCase(), style: 'tipoPedido', alignment: 'center' }
            ] : []),

            {
            text: [
                { text: 'Nro: ', bold: true },
                { text: comanda.nroPedido }
            ],
            style: 'datos'
            },

            ...(comanda.tipoPedidoId === 1 ? [
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
                }
            ] : [
                {
                    text: [
                        { text: 'Cliente: ', bold: true },
                        { text: comanda.cliente }
                    ],
                    style: 'datos'
                }
            ]),

            // Observación general: solo si el pedido la tiene (antes salía siempre un "* " vacío)
            ...(comanda.observacion && comanda.observacion.trim() != '' ? [{
            text: [
                { text: '* ', bold: true },
                { text: comanda.observacion }
            ],
            style: 'observacion'
            }] : []),

            {
            table: {
                // Columna C fija: con 'auto' las notas (colSpan: 2) con texto largo la ensanchaban
                widths: [16, '*'],
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
                // Columna C más angosta: padding lateral reducido para que entren 2 cifras (o un decimal)
                paddingLeft: function (i, node) { return i === 0 ? 1 : 3; },
                paddingRight: function (i, node) { return i === 0 ? 0 : 4; },
                paddingTop: function (i, node) { return 2; },
                paddingBottom: function (i, node) { return 2; },
            },
            style: 'tableStyle', // Aplicar el estilo a la tabla
            // Sin observación general no hay bloque (con su margen) entre los datos y la tabla: separamos la tabla
            margin: [0, comanda.observacion && comanda.observacion.trim() != '' ? 0 : 6, 0, 3]
            },

            ...(comanda.tieneComandaBarra ? [
                { text: 'También hay pedido en BARRA', style: 'avisoBarra', alignment: 'center' }
            ] : []),

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
            fontSize: 11,
            margin: [3, 0, 0, 0]
            },
            tipoPedido: {
            fontSize: 12,
            bold: true,
            decoration: 'underline',
            margin: [0, 0, 0, 4]
            },
            observacion: {
            fontSize: 11,
            bold: false,
            margin: [3, 5, 0, 5]
            },
            tableStyle: {
            fontSize: 10, // Cambiar el tamaño de letra de la tabla
            margin: [0, 0, 0, 3]
            },
            avisoBarra: {
            fontSize: 9,
            bold: true,
            italics: true,
            margin: [0, 4, 0, 0]
            }
        }
        };
    }

    private ArmarComanda80(comanda:ObjComanda){
        return {
        pageSize: {
            width: 200, 
            height: 800,
        },
        pageMargins: [comanda.margenIzq, 0, comanda.margenDer, 0],
        content: [
            ...(comanda.titulo ? [
                { text: comanda.titulo, alignment: 'center', style: 'titulo' }
            ] : []),

            { text: comanda.fechaPedido + " " +  comanda.horaPedido, alignment:"center", style:'fecha' },

            ...(comanda.tipoPedidoId !== 1 ? [
                { text: (comanda.tipoPedido || '').toUpperCase(), style: 'tipoPedido', alignment: 'center' }
            ] : []),

            {
            text: [
                { text: 'Nro: ', bold: true },
                { text: comanda.nroPedido }
            ],
            style: 'datos'
            },

            ...(comanda.tipoPedidoId === 1 ? [
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
                }
            ] : [
                {
                    text: [
                        { text: 'Cliente: ', bold: true },
                        { text: comanda.cliente }
                    ],
                    style: 'datos'
                }
            ]),

            // Observación general: solo si el pedido la tiene (antes salía siempre un "* " vacío)
            ...(comanda.observacion && comanda.observacion.trim() != '' ? [{
            text: [
                { text: '* ', bold: true },
                { text: comanda.observacion }
            ],
            style: 'observacion'
            }] : []),

            {
            table: {
                // Columna C fija: con 'auto' las notas (colSpan: 2) con texto largo la ensanchaban
                widths: [16, '*'],
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
                // Columna C más angosta: padding lateral reducido para que entren 2 cifras (o un decimal)
                paddingLeft: function (i, node) { return i === 0 ? 1 : 3; },
                paddingRight: function (i, node) { return i === 0 ? 0 : 4; },
                paddingTop: function (i, node) { return 2; },
                paddingBottom: function (i, node) { return 2; },
            },
            style: 'tableStyle', // Aplicar el estilo a la tabla
            // Sin observación general no hay bloque (con su margen) entre los datos y la tabla: separamos la tabla
            margin: [0, comanda.observacion && comanda.observacion.trim() != '' ? 0 : 6, 0, 3]
            },

            ...(comanda.tieneComandaBarra ? [
                { text: 'También hay pedido en BARRA', style: 'avisoBarra', alignment: 'center' }
            ] : []),

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
            tipoPedido: {
            fontSize: 14,
            bold: true,
            decoration: 'underline',
            margin: [0, 0, 0, 5]
            },
            observacion: {
            fontSize: 12,
            bold: false,
            margin: [3, 5, 0, 5]
            },
            tableStyle: {
            fontSize: 11, // Cambiar el tamaño de letra de la tabla
            margin: [0, 0, 0, 3]
            },
            avisoBarra: {
            fontSize: 10,
            bold: true,
            italics: true,
            margin: [0, 4, 0, 0]
            }
        }
    };
  }
}

export default new ComandaService();
