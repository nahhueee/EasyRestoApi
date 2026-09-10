export class ObjFacturar {
    total?:number;
    tipoFactura?:number;
    docNro?:number;
    docTipo?:number;
    // Condicion frente al IVA del receptor (5=Consumidor Final por defecto).
    // Determina el CondicionIVAReceptorId que exige ARCA desde la RG 5616 y,
    // junto con tipoFactura, si el comprobante es valido (ej: Factura A solo
    // es valida si el receptor es Responsable Inscripto).
    condReceptor?:number;

    // NC/ND (notas de credito/debito) no estan implementadas en EasyResto todavia.
    // Si se agregan en el futuro, EasySalesApi ya resuelve esto con un campo
    // `comprobanteAsociado: { tipo, puntoVenta, numero }` (ver EasySalesApi/src/models/objFacturar.ts
    // y facturacionService.ts / notaCreditoService.ts) que se manda en `CbtesAsoc` a ARCA.

    constructor(data?: any) {
        if (data) {
          this.total = data.total;
          this.tipoFactura = data.tipoFactura;
          this.docNro = data.docNro;
          this.docTipo = data.docTipo;
          this.condReceptor = data.condReceptor;
        }
    }
}