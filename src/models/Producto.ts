import { Categoria } from "./Categoria";
import { ProductoAdicional } from "./ProductoAdicional";
import { ProductoPrecio } from "./ProductoPrecio";

export class Producto {
    id : number = 0;
    nombre : string = "";
    tipo?: "elaborado" | "terciarizado";
    categoria? : Categoria;
    imagen : string = "";
    cantidad: number = 0; 
    descripcion: string = "";

    precios? : ProductoPrecio[] 
    adicionales? : ProductoAdicional[] 

    constructor(data?: any) {
        if (data) {
            this.id = data.id;
            this.nombre = data.nombre;
            this.tipo = data.tipo;
            this.categoria = new Categoria(data.categoria);
            this.imagen = data.imagen;
            this.cantidad = data.cantidad;
            this.descripcion = data.descripcion;

            if(data.precios) 
                this.precios = new Array<ProductoPrecio>(data.precios);

            if(data.adicionales) 
                this.adicionales = new Array<ProductoAdicional>(data.adicionales);
        }
    }
}