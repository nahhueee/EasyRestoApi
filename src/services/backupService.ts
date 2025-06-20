import {ParametrosRepo} from '../data/parametrosRepository';
import {BackupsRepo} from '../data/backupsRepository';
import {AdminServ} from '../services/adminService';
import config from '../conf/app.config';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import logger from '../log/loggerGeneral';

const moment = require('moment');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

let scheduledTask; // Variable para guardar la tarea programada
class BackupsService{

    
    async IniciarCron(){
        try{ 
            //Obtenemos los parametros necesarios
            //#region PARAMETROS
            const dniCliente = await ParametrosRepo.ObtenerParametros('dni');
            const expresion = await ParametrosRepo.ObtenerParametros('expresion');
            //#endregion

            if(dniCliente!="")
                this.EjecutarProcesoCron(dniCliente, expresion);
                  
        } catch(error:any){
            logger.error("Error al intentar iniciar los procesos de respaldo. " + error.message);
        }
    }

    async GenerarBackupLocal(){
        try {
            const carpeta = path.join('C:', 'backups');

            if (!fs.existsSync(carpeta)) {
                fs.mkdirSync(carpeta, { recursive: true });
            } 

            const fecha = new Date().toISOString().slice(0, 10); 
            const archivo = path.join(carpeta, `respaldo_${fecha}.sql`);
            await GenerarBackup(archivo);

            return "OK";

        } catch (error) {
            throw error;
        }
       
    }

    //Funcion para inicar el cron de respaldo
    async EjecutarProcesoCron(DNI:string, expresion:string){
        try{

            if (expresion!="") {

                // Si ya existe una tarea programada, la detenemos para iniciar una nueva y no crear crones en simultaneo
                if (scheduledTask) {
                    scheduledTask.stop();
                    scheduledTask = null;
                }
                
                //Solo si el parametro de activar esta habilitado, iniciamos el proceso de cron
                const activarBackup = await ParametrosRepo.ObtenerParametros('backups');
                if (activarBackup !== "true") {
                    return;
                }

                //Verificamos que el cliente este habilitado para sincronizar
                const habilitado = await AdminServ.ObtenerHabilitacion(DNI)
                if (!habilitado) {
                    logger.info('Cliente inexistente o inhabilitado para generar backups.');
                    return;
                }

                // Programamos la nueva tarea para crear backups
                scheduledTask = cron.schedule(expresion, async () => {
                    logger.info('Se inicia un nuevo proceso de respaldo en cron.');

                    //Nombre del archivo
                    const fileName = `${DNI}_${moment().format('DD-MM-YYYY')}.sql`;

                    //Path donde guardamos el backup    
                    const backupPath = path.join(__dirname, "../upload/", fileName);
                    await eliminarArchivo(backupPath); // Elimina el archivo

                    //Generamos el backup
                    await GenerarBackup(backupPath)
                    if(!existsSync(backupPath)){
                        logger.error('Parece que ocurrio un error al intentar generar un backup.');
                        return;
                    }

                    //El servidor se encarga de verificar si el usuario tiene mas de 3 backups subidos
                    //Se borra el más antiguo, y se sube el nuevo
                    const resultado = await AdminServ.SubirBackup(backupPath, DNI);
                    if(resultado=="OK"){
                        logger.info('Se subió correctamente el archivo al servidor.');

                        //Agregamos el registro a la base local
                        await BackupsRepo.Agregar(fileName);
                        fs.unlinkSync(backupPath); // Elimina el archivo localmente
                    }
                    else
                        logger.error('Ocurrió un error al intentar subir el archivo al servidor. ' + resultado);

                    
                    logger.info('Finalizó correctamente el proceso de respaldo.');
                });

            }
        }
        catch (error: any) {
            logger.error("Error dentro del proceso cron: " + error.message);
            console.error(error);
        }
    }
}

async function eliminarArchivo(filePath: string) {
    if (existsSync(filePath)) { // Verifica si el archivo existe
        try {
            await unlink(filePath); // Elimina el archivo
        } catch (error) {
            logger.error(`Error al intentar eliminar el archivo: ${error}`);
        }
    } 
}

async function GenerarBackup(backupPath: string) {
    return new Promise<boolean>((resolve, reject) => {
        const args = [`-u`, config.db.user];

        if (config.produccion) {
            args.push(`-p${config.db.password}`);
        }

        args.push(config.db.database);

        const dumpProcess = spawn('mysqldump', args);
        const output = createWriteStream(backupPath);

        dumpProcess.stdout.pipe(output);

        dumpProcess.stderr.on('data', (data) => {
            logger.error(`Error en mysqldump: ${data}`);
        });

        dumpProcess.on('close', (code) => {
            if (code === 0) {
                logger.info(`Backup generado correctamente`);
                resolve(true);
            } else {
                logger.error(`mysqldump finalizó con código: ${code}`);
                reject(false);
            }
        });

        dumpProcess.on('error', (err) => {
            logger.error(`Error al lanzar mysqldump: ${err}`);
            reject(false);
        });
    });
}

export const BackupsServ = new BackupsService();