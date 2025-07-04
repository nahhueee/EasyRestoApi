import { ListaPrecio } from "./ListaPrecio";

export class ProductosPrecios {
    id?:number;
    idProducto?:number;
    listaPrecio?:ListaPrecio;
    descripcion? : string;
    costo : number = 0;
    precio : number = 0;
    mostrarDesc: boolean = false;

    constructor(data?: any) {
        if (data) {
            this.id = data.id;
            this.idProducto = data.idProducto;
            this.listaPrecio = data.listaPrecio;
            this.descripcion = data.descripcion;
            this.mostrarDesc = data.mostrarDesc;
            this.costo = parseFloat(data.costo);
            this.precio = parseFloat(data.precio);
        }
    }
}