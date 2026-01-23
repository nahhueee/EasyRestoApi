import {Router, Request, Response} from 'express';
import { upload, fullPath, uniqueName } from '../conf/upload_config'; // Importar configuración de Multer y las variables
import logger from '../log/loggerGeneral';
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

router.post('/imprimir-pdf', async (req: Request, res: Response) => {
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
      // Primera comanda: elaborado
      const comandaElaborado = await ComandaServ.GenerarComandaPDF(
        pedido,
        parametrosImpresion,
        'elaborado'
      );

      await imprimirPDF(comandaElaborado);

      // Segunda comanda: terciarizado (si aplica)
      if (parametrosImpresion.comandaDoble === 1) {
        const filas = pedido.detalles!.filter(item => item.tipoProd == 'terciarizado' || item.producto?.includes("PROMO"));
        if (filas.length > 0) {
          const comandaTerciarizado = await ComandaServ.GenerarComandaPDF(
            pedido,
            parametrosImpresion,
            'terciarizado'
          );

          await imprimirPDF(comandaTerciarizado);
        }
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

  } catch (error: any) {
    let msg = "Error al imprimir el documento.";
    logger.error(msg + " " + error.message);
    res.status(500).send(msg);
  }
});

router.post('/imprimir-resumen', async (req: Request, res: Response) => {
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

  } catch (error: any) {
    let msg = "Error al imprimir el resumen.";
    logger.error(msg + " " + error.message);
    res.status(500).send(msg);
  }
});

router.post('/ver-resumen', async (req: Request, res: Response) => {
  try {
    const parametrosImpresion = await ParametrosRepo.ObtenerParametrosImpresion();
    const pdfBuffer = await ResumenServ.GenerarResumenPDF(req.body, parametrosImpresion);

    // Devolver el PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=comanda.pdf');
    res.send(pdfBuffer);

  } catch (error: any) {
    let msg = "Error al generar el resumen.";
    logger.error(msg + " " + error.message);
    res.status(500).send(msg);
  }
});

router.post('/ver-comanda', async (req: Request, res: Response) => {
  try {
    const parametrosImpresion = await ParametrosRepo.ObtenerParametrosImpresion();
    const pdfBuffer = await ComandaServ.GenerarComandaPDF(req.body, parametrosImpresion);

    // Devolver el PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=comanda.pdf');
    res.send(pdfBuffer);

  } catch (error: any) {
    let msg = "Error al generar la comanda.";
    logger.error(msg + " " + error.message);
    res.status(500).send(msg);
  }
});

router.post('/ver-comprobante/:tipoComprobante', async (req: Request, res: Response) => {
  try {
    const parametrosImpresion = await ParametrosRepo.ObtenerParametrosImpresion();
    const pdfBuffer = await ComprobanteServ.GenerarComprobantePDF(req.body, parametrosImpresion, req.params.tipoComprobante);

    // Devolver el PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=comprobante.pdf');
    res.send(pdfBuffer);

  } catch (error: any) {
    let msg = "Error al generar el comprobante.";
    logger.error(msg + " " + error.message);
    res.status(500).send(msg);
  }
});
//#endregion

//#region SUBIDA DE IMAGENES
router.post('/subir-imagen', upload.single('image'), (req:Request, res:Response) => {
    try{ 
        return res.json(uniqueName);

    } catch(error:any){
        let msg = "Error al subir una imagen.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});

router.get('/obtener-imagen/:imgName', (req:Request, res:Response) => {
    try{ 
        const imagePath = path.join(__dirname, "../upload/", req.params.imgName);
  
        // Devolver la imagen
        res.sendFile(imagePath);

    } catch(error:any){
        let msg = "Error al obtener la imagen.";
        logger.error(msg + " " + error.message);
        res.status(500).send(msg);
    }
});
//#endregion

// Export the router
export default router; 