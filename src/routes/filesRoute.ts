import {Router, Request, Response} from 'express';
import { upload, fullPath, uniqueName } from '../conf/upload_config'; // Importar configuración de Multer y las variables
import logger from '../log/loggerGeneral';
import ComandaServ from '../services/comandaService';
import ComprobanteServ from '../services/comprobanteService';
import { v4 as uuid } from 'uuid';
import { ParametrosRepo } from '../data/parametrosRepository';
const path = require('path');
const router : Router  = Router();

//#region PDFS
const printer = require('pdf-to-printer');
const fs = require('fs');

// router.post('/imprimir-pdf', upload.single('doc'), (req:Request, res:Response) => {
//     const printerName = req.body.printerName;

//     printer.print(fullPath, { printer: printerName, orientation: 'portrait', scale: 'noscale'})
//     .then(() => {
//         res.status(200).json('OK');
//         fs.unlinkSync(fullPath); // Elimina el archivo temporal
//     })
//     .catch((error) => {
//         let msg = "Error al intentar imprimir el documento.";
//         logger.error(msg + " " + error);
//         res.status(500).send(msg);
//     });   
// });

router.post('/imprimir-pdf', async (req: Request, res: Response) => {
  try {
    const tipoImpresion = req.body.tipoImpresion;
    const pedido = req.body.pedido;
    const tipoComprobante = req.body.tipoComprobante;
    const parametrosImpresion = await ParametrosRepo.ObtenerParametrosImpresion();

    const pdfBuffer =
    tipoImpresion === "comanda"
    ? await ComandaServ.GenerarComandaPDF(pedido, parametrosImpresion)
    : await ComprobanteServ.GenerarComprobantePDF(pedido, parametrosImpresion, tipoComprobante)
    
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
    let msg = "Error al imprimir el documento.";
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