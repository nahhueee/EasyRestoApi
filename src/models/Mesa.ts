export class Mesa {
    id?:number;
    idSalon?:number;
    codigo?:string;
    codGrupo?:string;
    idPedido?:number;
    combinada?:string;
    principal?:boolean;
    asignacion?:number;
    usuarioAsignado?:string;

    constructor(data?: any) {
        if (data) {
          this.id = data.id;
          this.idSalon = data.idSalon;
          this.codigo = data.codigo;
          this.codGrupo = data.codGrupo;
          this.idPedido = data.idPedido;
          this.combinada = data.combinada;
          this.principal = data.principal;
          this.asignacion = data.asignacion;
          this.usuarioAsignado = data.usuarioAsignado;
        }
    }
}