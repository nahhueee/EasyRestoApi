export class Mesa {
    id?:number;
    idSalon?:number;
    codigo?:string;
    numero?:number;
    codGrupo?:string;
    idPedido?:number;
    combinada?:string;
    principal?:boolean;
    asignacion?:number;
    usuarioAsignado?:string;
    estado?: string;

    constructor(data?: any) {
        if (data) {
          this.id = data.id;
          this.idSalon = data.idSalon;
          this.codigo = data.codigo;
          this.numero = data.numero;
          this.codGrupo = data.codGrupo;
          this.idPedido = data.idPedido;
          this.combinada = data.combinada;
          this.principal = data.principal;
          this.asignacion = data.asignacion;
          this.usuarioAsignado = data.usuarioAsignado;
        }
    }
}