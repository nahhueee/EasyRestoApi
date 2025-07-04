import { Adicional } from "./Adicional";

export class ProductosAdicionales {
    idProducto?:number;
    adicional?:Adicional;
    recargo:number = 0;

    constructor(data?: any) {
        if (data) {
          this.idProducto = data.idProducto;
          this.adicional = data.adicional;
          this.recargo = parseFloat(data.recargo);
        }
    }
}