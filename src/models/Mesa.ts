export class Mesa {
    id?:number;
    idSalon?:number;
    codigo?:string;
    idPedido?:number;
    combinada?:string;
    principal?:boolean;

    constructor(data?: any) {
        if (data) {
          this.id = data.id;
          this.idSalon = data.idSalon;
          this.codigo = data.codigo;
          this.idPedido = data.idPedido;
          this.combinada = data.combinada;
          this.principal = data.principal;
        }
    }
}