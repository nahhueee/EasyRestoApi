export class DetallePedido{
    id?: number;
    idPedido?: number;
    idProdVar? : number;
    productoVariedad?: string;
    tipoProdVar?: "Producto" | "Variedad";
    cantidad?: number;
    unitario?: number;
    total?: number;
    obs?: string;
  
    constructor(data?: any) {
      if (data) {
        this.id = data.id;
        this.idPedido = data.idPedido;
        this.idProdVar = data.idProdVar;
        this.cantidad = data.cantidad;
        this.unitario = data.unitario;
        this.productoVariedad = data.productoVariedad;
        this.tipoProdVar = data.tipoProdVar;
        this.total = data.total;
        this.obs = data.obs;
      }
    }
  }
  
  