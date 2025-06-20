import {Router, Request, Response} from 'express';
import { upload, fullPath, uniqueName } from '../conf/upload_config'; // Importar configuración de Multer y las variables
import logger from '../log/loggerGeneral';
const path = require('path');
const router : Router  = Router();

//#region IMPRESION DE PDFS
const printer = require('pdf-to-printer');
const fs = require('fs');

router.post('/imprimir-pdf', upload.single('doc'), (req:Request, res:Response) => {
    const printerName = req.body.printerName;

    printer.print(fullPath, { printer: printerName, orientation: 'portrait', scale: 'noscale'})
    .then(() => {
        res.status(200).json('OK');
        fs.unlinkSync(fullPath); // Elimina el archivo temporal
    })
    .catch((error) => {
        let msg = "Error al intentar imprimir el documento.";
        logger.error(msg + " " + error);
        res.status(500).send(msg);
    });   
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