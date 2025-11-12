export class Usuario{
  id? : number;
  nombre?: string;
  cargo?: string;
 
  constructor(data?: any) {
    if (data) {
      this.id = data.id;
      this.nombre = data.nombre;
      this.cargo = data.cargo;
    }
  }
}

