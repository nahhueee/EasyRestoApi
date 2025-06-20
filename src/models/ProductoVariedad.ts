import { Rubro } from "./Rubro";
import { VarianteVariedad } from "./VarianteVariedad";

export class ProductoVariedad {
    id : number = 0;
    nombre? : string;
    tipo?: "Producto" | "Variedad";
    rubro? : Rubro;
    imagen : string = "";
    costo : number = 0;
    precioLocal : number = 0;
    precioDelivery : number = 0;

    cantidad?: number; // solo si es tipo "Producto"
    variantes? : VarianteVariedad[] //solo para "Variedad"

    constructor(data?: any) {
        if (data) {
            this.id = data.id;
            this.nombre = data.nombre;
            this.tipo = data.tipo;
            this.rubro = data.rubro;
            this.imagen = data.imagen;
            this.costo = parseFloat(data.costo);
            this.precioLocal = parseFloat(data.precioLocal);
            this.precioDelivery = parseFloat(data.precioDelivery);
            this.cantidad = parseFloat(data.cantidad);

            if(data.variantes) 
                this.variantes = new Array<VarianteVariedad>(data.variantes);
        }
    }
}