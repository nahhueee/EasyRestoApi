import { TipoPago } from "./TipoPago";

export class DetallePago{
    idPedido? : number;
    tipoPago : TipoPago = new TipoPago();
    monto : number = 0;
    
    constructor(data?: any) {
      if (data) {
        this.idPedido = data.idPedido;
        this.tipoPago = data.tipoPago;
        this.monto = data.monto;
      }
    }
  }
  