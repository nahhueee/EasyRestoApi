export class ObjResumen {
    papel:string = "58mm";
    margenIzq:number = 0;
    margenDer:number = 0;
    fecha?:Date;
    hora?:string;
    usuario?:string;
    inicial?:number;
    pedidos?:number;
    entradas?:number;
    salidas?:number;
    total?:number;

    efectivo?:number;
    transferencia?:number;
    tarjetas?:number;
    restoCombinado?:number;

    cantPedidos?:number;
}