import { TipoPago } from "./TipoPago";

export class PedidoPago{
    idPedido? : number;
    tipoPago?: TipoPago;
    efectivo? : number;
    digital? : number;
    recargo? : number;
    descuento? : number;
    tipoRecDes? : string;
    realizado? : boolean;
  
    constructor(data?: any) {
      if (data) {
        this.idPedido = data.idPedido;
        this.tipoPago = data.tipoPago;
        this.efectivo = data.efectivo;
        this.digital = data.digital;
        this.recargo = data.recargo;
        this.descuento = data.descuento;
        this.tipoRecDes = data.tipoRecDes;
        this.realizado = data.realizado;
      }
    }
  }
  
  