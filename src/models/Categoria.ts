export class Categoria {
    id?:number;
    nombre?:string;
    icono?:string;
    favorita?:boolean;

    constructor(data?: any) {
        if (data) {
          this.id = data.id;
          this.nombre = data.nombre;
          this.icono = data.icono;
          this.favorita = data.favorita;
        }
    }
}