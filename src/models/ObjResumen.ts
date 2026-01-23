import { Pedido } from "./Pedido";

export class ObjResumen {
    papel:string = "58mm";
    margenIzq:number = 0;
    margenDer:number = 0;
    fecha?:Date;
    hora?:string;
    usuario?:string;
    mozo?:string;
    inicial?:number;
    pedidos?:number;
    entradas?:number;
    salidas?:number;
    total?:number;
    detalles?:any[];
    filasTabla?:any[];

    efectivo?:number;
    transferencia?:number;
    tarjetas?:number;
    qr?:number;
    restoCombinado?:number;

    cantPedidos?:number;
}