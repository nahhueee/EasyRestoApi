export class Categoria {
    id?:number;
    nombre?:string;
    favorita?:boolean;

    constructor(data?: any) {
        if (data) {
          this.id = data.id;
          this.nombre = data.nombre;
          this.favorita = data.favorita;
        }
    }
}