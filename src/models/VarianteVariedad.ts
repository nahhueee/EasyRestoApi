export class VarianteVariedad {
    descripcion? : string;
    costo : number = 0;
    precioLocal : number = 0;
    precioDelivery : number = 0;

    constructor(data?: any) {
        if (data) {
            this.descripcion = data.descripcion;
            this.costo = parseFloat(data.costo);
            this.precioLocal = parseFloat(data.precioLocal);
            this.precioDelivery = parseFloat(data.precioDelivery);
        }
    }
}