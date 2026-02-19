import { TipoPago } from "./TipoPago";

export class PedidoPago{
    idPedido? : number;
    recargo? : number;
    descuento? : number;
    tipoRecDes? : string;
    realizado? : boolean;
    monto? : number;
  
    constructor(data?: any) {
      if (data) {
        this.idPedido = data.idPedido;
        this.recargo = data.recargo;
        this.descuento = data.descuento;
        this.tipoRecDes = data.tipoRecDes;
        this.realizado = data.realizado;
        this.monto = data.monto;
      }
    }
  }
  
  