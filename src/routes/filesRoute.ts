import {Router, Request, Response} from 'express';
import { AppError } from '../log/AppError';
import { CodigoError } from '../log/CodigosError';
import { upload, fullPath, uniqueName } from '../conf/upload_config'; // Importar configuración de Multer y las variables
import ComandaServ from '../services/comandaService';
import ComprobanteServ from '../services/comprobanteService';
import ResumenServ from '../services/resumenService';
import { v4 as uuid } from 'uuid';
import { ParametrosRepo } from '../data/parametrosRepository';
const path = require('path');
const router : Router  = Router();

//#region PDFS
const printer = require('pdf-to-printer');
const fs = require('fs');

router.post('/imprimir-pdf', async (req: Request, res: Response, next) => {
  try {
    const tipoImpresion = req.body.tipoImpresion;
    const pedido = req.body.pedido;
    const tipoComprobante = req.body.tipoComprobante;
    const parametrosImpresion = await ParametrosRepo.ObtenerParametrosImpresion();

    const imprimirPDF = async (pdfBuffer: Buffer) => {
      const tempName = `impresion_${uuid()}.pdf`;
      const tempPath = path.join(__dirname, '..', 'temp', tempName);

      fs.writeFileSync(tempPath, pdfBuffer);

      await printer.print(tempPath, {
        printer: parametrosImpresion.impresora,
        orientation: 'portrait',
        scale: 'noscale'
      });

      fs.unlinkSync(tempPath);
    };

    if (tipoImpresion === 'comanda') {
      // El reparto entre comandas lo decide el backend (sector del producto en la base +
      // destinos configurados). Ver ComandaServ.PlanificarComandas.
      const plan = await ComandaServ.PlanificarComandas(pedido, parametrosImpresion);

      // Comanda principal: se imprime siempre (aunque quede vacía), igual que antes
      const comandaPrincipal = await ComandaServ.GenerarComandaPDF(
        pedido,
        parametrosImpresion,
        plan.principal,
        { tieneComandaBarra: plan.barra != null }
      );

      await imprimirPDF(comandaPrincipal);

      // Comanda de barra: solo si hay algo para la barra
      if (plan.barra) {
        const comandaBarra = await ComandaServ.GenerarComandaPDF(
          pedido,
          parametrosImpresion,
          plan.barra,
          { titulo: 'COMANDA BARRA' }
        );

        await imprimirPDF(comandaBarra);
      }

    } else {
      // Comprobante normal
      const comprobante = await ComprobanteServ.GenerarComprobantePDF(
        pedido,
        parametrosImpresion,
        tipoComprobante
      );

      await imprimirPDF(comprobante);
    }

    res.status(200).json('OK');

  } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al imprimir el documento.", 500, { modulo: 'filesRoute.imprimir-pdf' }, error));
    }
});

router.post('/imprimir-resumen', async (req: Request, res: Response, next) => {
  try {
    const resumen = req.body.resumen;
    const parametrosImpresion = await ParametrosRepo.ObtenerParametrosImpresion();

    const pdfBuffer = await ResumenServ.GenerarResumenPDF(resumen, parametrosImpresion);
    
    //Crear archivo temporal
    const tempName = `impresion_${uuid()}.pdf`;
    const tempPath = path.join(__dirname, '..', 'temp', tempName);

    fs.writeFileSync(tempPath, pdfBuffer);

    //Enviar a la impresora
    await printer.print(tempPath, {
      printer: parametrosImpresion.impresora,
      orientation: 'portrait',
      scale: 'noscale'
    });

    //Eliminar archivo temporal
    fs.unlinkSync(tempPath);

    res.status(200).json('OK');

  } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al imprimir el resumen.", 500, { modulo: 'filesRoute.imprimir-resumen' }, error));
    }
});

router.post('/ver-resumen', async (req: Request, res: Response, next) => {
  try {
    const parametrosImpresion = await ParametrosRepo.ObtenerParametrosImpresion();
    const pdfBuffer = await ResumenServ.GenerarResumenPDF(req.body, parametrosImpresion);

    // Devolver el PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=comanda.pdf');
    res.send(pdfBuffer);

  } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al generar el resumen.", 500, { modulo: 'filesRoute.ver-resumen' }, error));
    }
});

router.post('/ver-comanda', async (req: Request, res: Response, next) => {
  try {
    const parametrosImpresion = await ParametrosRepo.ObtenerParametrosImpresion();
    // Muestra la comanda principal, armada igual que al imprimir
    const plan = await ComandaServ.PlanificarComandas(req.body, parametrosImpresion);
    const pdfBuffer = await ComandaServ.GenerarComandaPDF(req.body, parametrosImpresion, plan.principal, { tieneComandaBarra: plan.barra != null });

    // Devolver el PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=comanda.pdf');
    res.send(pdfBuffer);

  } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al generar la comanda.", 500, { modulo: 'filesRoute.ver-comanda' }, error));
    }
});

router.post('/ver-comprobante/:tipoComprobante', async (req: Request, res: Response, next) => {
  try {
    const parametrosImpresion = await ParametrosRepo.ObtenerParametrosImpresion();
    const pdfBuffer = await ComprobanteServ.GenerarComprobantePDF(req.body, parametrosImpresion, req.params.tipoComprobante);

    // Devolver el PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=comprobante.pdf');
    res.send(pdfBuffer);

  } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al generar el comprobante.", 500, { modulo: 'filesRoute.ver-comprobante' }, error));
    }
});
//#endregion

//#region SUBIDA DE IMAGENES
router.post('/subir-imagen', upload.single('image'), (req:Request, res:Response, next) => {
    try{ 
        return res.json(uniqueName);

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al subir una imagen.", 500, { modulo: 'filesRoute.subir-imagen' }, error));
    }
});

router.get('/obtener-imagen/:imgName', (req:Request, res:Response, next) => {
    try{ 
        const imagePath = path.join(__dirname, "../upload/", req.params.imgName);
  
        // Devolver la imagen
        res.sendFile(imagePath);

    } catch(error:any){
        next(new AppError(CodigoError.INTERNAL_ERROR, "Error al obtener la imagen.", 500, { modulo: 'filesRoute.obtener-imagen' }, error));
    }
});
//#endregion

// Export the router
export default router; 