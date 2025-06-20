export class Mesa {
    id?:number;
    codigo?:string;

    constructor(data?: any) {
        if (data) {
          this.id = data.id;
          this.codigo = data.codigo;
        }
    }
}