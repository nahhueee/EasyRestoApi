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
    descuento?:number;
    recargo?:number;
    tipoRecDes?:string;
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
          this.recargo = data.recargo;
          this.filasTabla = data.filasTabla;
          this.totalProdVar = data.totalProdVar;
          this.totalFinal = data.totalFinal;
        }
    }
}