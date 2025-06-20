import { Mesa } from "./Mesa";
import { DetallePedido } from "./PedidoDetalle";
import { PedidoFactura } from "./PedidoFactura";
import { PedidoPago } from "./PedidoPago";
import { TipoPedido } from "./TipoPedido";
import { Usuario } from "./Usuario";

export class Pedido {
    id? : number;
    fecha? : Date;
    hora? : string;
    total? : number;
    mesa? : Mesa;
    responsable? : Usuario;
    tipoPedido? : TipoPedido;
    obs? : string;
    cliente? : string;
    finalizado?: number;

    pago? : PedidoPago;
    factura? : PedidoFactura;
    detalles? : DetallePedido[] = [];
  
    constructor(data?: any) {
      if (data) {
        this.id = data.id;
        this.fecha = data.fecha;
        this.hora = data.hora;
        this.total = data.total;
        this.finalizado = data.finalizado;
        this.mesa = new Mesa(data.mesa);
        this.responsable = new Usuario(data.usuario);
        this.tipoPedido = new TipoPedido(data.tipoPedido);
        this.pago = new PedidoPago(data.pago);
        this.factura = new PedidoFactura(data.pago);
        this.detalles = data.detalles;
        this.obs = data.obs;
        this.cliente = data.cliente;
      }
    }
}