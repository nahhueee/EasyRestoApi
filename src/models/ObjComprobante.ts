export class ObjComprobante {
    papel?:string;
    margenIzq:number = 0;
    margenDer:number = 0;
    nombreLocal?:string;
    desLocal?:string;
    dirLocal?:string;
    fechaPedido?:string;
    horaPedido?:string;
    mesa?:string;
    responsable?:string;
    cliente?:string;
    tipoPedidoId?:number;
    tipoPedido?:string;
    descuento?:number;
    recargo?:number;
    tipoRecDes?:string;
    /** Observación cargada junto al recargo/descuento (ver RecargoDescuentoComponent). Se muestra sutil en el bloque de totales. */
    obs?:string;
    filasTabla?:any[];
    totalProdVar?:number;
    totalFinal?:number;

    constructor(data?: any) {
        if (data) {
          this.papel = data.papel;
          this.margenIzq = data.margenIzq;
          this.margenDer = data.margenDer;
          this.nombreLocal = data.nombreLocal;
          this.desLocal = data.desLocal;
          this.dirLocal = data.dirLocal;
          this.fechaPedido = data.fechaPedido;
          this.horaPedido = data.horaPedido;
          this.descuento = data.descuento;
          this.tipoRecDes = data.tipoRecDes;
          this.mesa = data.mesa;
          this.responsable = data.responsable;
          this.cliente = data.cliente;
          this.tipoPedidoId = data.tipoPedidoId;
          this.tipoPedido = data.tipoPedido;
          this.recargo = data.recargo;
          this.obs = data.obs;
          this.filasTabla = data.filasTabla;
          this.totalProdVar = data.totalProdVar;
          this.totalFinal = data.totalFinal;
        }
    }
}