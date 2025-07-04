import { Categoria } from "./Categoria";
import { ProductosAdicionales } from "./ProductosAdicionales";
import { ProductosPrecios } from "./ProductosPrecios";

export class Producto {
    id : number = 0;
    nombre : string = "";
    tipo?: "elaborado" | "terciarizado";
    categoria? : Categoria;
    imagen : string = "";
    cantidad: number = 0; 
    descripcion: string = "";

    precios? : ProductosPrecios[] 
    adicionales? : ProductosAdicionales[] 

    constructor(data?: any) {
        if (data) {
            this.id = data.id;
            this.nombre = data.nombre;
            this.tipo = data.tipo;
            this.categoria = new Categoria(data.categoria);
            this.imagen = data.imagen;
            this.cantidad = data.cantidad;

            if(data.precios) 
                this.precios = new Array<ProductosPrecios>(data.precios);

            if(data.adicionales) 
                this.adicionales = new Array<ProductosAdicionales>(data.adicionales);
        }
    }
}