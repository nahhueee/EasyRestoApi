export class DetallePedido{
    id?: number;
    idPedido?: number;
    idProducto? : number;
    producto?: string;
    tipoProd?: "elaborado" | "terciarizado";
    cantidad?: number;
    costo?: number;
    unitario?: number;
    total?: number;
    obs?: string;
  
    constructor(data?: any) {
      if (data) {
        this.id = data.id;
        this.idPedido = data.idPedido;
        this.idProducto = data.idProducto;
        this.cantidad = data.cantidad;
        this.costo = data.costo;
        this.unitario = data.unitario;
        this.producto = data.producto;
        this.tipoProd = data.tipoProd;
        this.total = data.total;
        this.obs = data.obs;
      }
    }
  }
  
  