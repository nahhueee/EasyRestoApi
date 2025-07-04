export class Mesa {
    id?:number;
    codigo?:string;
    disponible?:boolean;
    icono?:string;
    combinada?:string;
    principal?:boolean;

    constructor(data?: any) {
        if (data) {
          this.id = data.id;
          this.codigo = data.codigo;
          this.disponible = data.disponible;
          this.icono = data.icono;
          this.combinada = data.combinada;
          this.principal = data.principal;
        }
    }
}