export class ObjComanda {
    papel:string = "58mm";
    nroPedido?:number;
    mesa?:string;
    mozo?:string;
    cliente?:string;
    fechaPedido?:string;
    horaPedido?:string;
    observacion?:string;
    filasTabla?:any[];
    margenIzq:number = 0;
    margenDer:number = 0;

    constructor(data?: any) {
        if (data) {
          this.papel = data.papel;
          this.nroPedido = data.nroPedido;
          this.mesa = data.mesa;
          this.mozo = data.mozo;
          this.cliente = data.cliente;
          this.fechaPedido = data.fechaPedido;
          this.horaPedido = data.horaPedido;
          this.observacion = data.observacion;
          this.filasTabla = data.filasTabla;
          this.margenIzq = data.margenIzq;
          this.margenDer = data.margenDer;
        }
    }
}