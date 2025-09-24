import { Mesa } from "./Mesa";
import { DetallePedido } from "./PedidoDetalle";
import { PedidoFactura } from "./PedidoFactura";
import { PedidoPago } from "./PedidoPago";
import { TipoPedido } from "./TipoPedido";
import { Usuario } from "./Usuario";

export class Pedido {
    id? : number;
    tipo?: TipoPedido;
    fecha? : Date;
    hora? : string;
    total? : number;
    mesa? : Mesa;
    responsable? : Usuario;
    obs? : string;
    cliente? : string;
    finalizado?: number;
    ticketImp?: string;
    comandaImp?: string;

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
        this.ticketImp = data.ticketImp;
        this.comandaImp = data.comandaImp;
        this.mesa = new Mesa(data.mesa);
        this.responsable = new Usuario(data.usuario);
        this.tipo = new TipoPedido(data.tipo);
        this.pago = new PedidoPago(data.pago);
        this.factura = new PedidoFactura(data.pago);
        this.detalles = data.detalles;
        this.obs = data.obs;
        this.cliente = data.cliente;
      }
    }
}