import {ParametrosRepo} from '../data/parametrosRepository';
import {BackupsRepo} from '../data/backupsRepository';
import {AdminServ} from '../services/adminService';
import config from '../conf/app.config';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import logger from '../log/logger';
import { CodigoError } from '../log/CodigosError';

const moment = require('moment');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const RUTA_ESTADO_BACKUP = path.join(process.cwd(), 'src', 'log', 'backup-estado.json');
const RUTA_TERMINAL = path.join(process.cwd(), 'terminal.json');

// Identidad de terminal: lectura local, igual que heartbeatService/errorBatchService.
// Sin terminal.json (instalación aún no pasó por el componente de identidad), no hay
// a quién consultarle habilitación: se omite el ciclo de backup.
function obtenerTerminal(): string | null {
    try {
        if (!fs.existsSync(RUTA_TERMINAL)) return null;
        const data = JSON.parse(fs.readFileSync(RUTA_TERMINAL, 'utf-8'));
        return data.terminal ?? null;
    } catch {
        return null;
    }
}

// Escribe el resultado del último backup del cron para que heartbeatService lo reporte.
// Formato {fecha, ok} — igual al de EasySalesApi (heartbeatService lee estos nombres).
function escribirEstadoBackup(ok: boolean) {
    try {
        fs.writeFileSync(RUTA_ESTADO_BACKUP, JSON.stringify({
            fecha: new Date().toISOString(),
            ok,
        }, null, 2));
    } catch (error: any) {
        logger.error({
            code: CodigoError.BACKUP_GENERACION_ERROR,
            message: `No se pudo escribir backup-estado.json: ${error.message || error}`,
            modulo: 'backupService',
            stack: error?.stack,
        });
    }
}

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
            logger.error({
                code: CodigoError.CRON_INIT_ERROR,
                message: error.message || 'Error al intentar iniciar los procesos de respaldo',
                modulo: 'backupService',
                stack: error?.stack,
            });
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
                const terminal = obtenerTerminal();
                if (!terminal) {
                    logger.info('Sin terminal registrada; se omite el ciclo de backup.');
                    return;
                }

                const habilitado = await AdminServ.ObtenerHabilitacion(terminal)
                if (!habilitado) {
                    logger.info('Terminal inexistente o inhabilitada para generar backups.');
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
                    try {
                        await GenerarBackup(backupPath);
                    } catch (error: any) {
                        // GenerarBackup ya logueó el detalle (stderr de mysqldump); acá solo cerramos el estado.
                        escribirEstadoBackup(false);
                        return;
                    }

                    if(!existsSync(backupPath)){
                        logger.error({
                            code: CodigoError.BACKUP_GENERACION_ERROR,
                            message: 'Parece que ocurrió un error al intentar generar un backup (el archivo no existe)',
                            modulo: 'backupService',
                        });
                        escribirEstadoBackup(false);
                        return;
                    }

                    //El servidor se encarga de verificar si el usuario tiene mas de 3 backups subidos
                    //Se borra el más antiguo, y se sube el nuevo
                    try {
                        const resultado = await AdminServ.SubirBackup(backupPath, DNI);
                        if(resultado=="OK"){
                            logger.info('Se subió correctamente el archivo al servidor.');

                            //Agregamos el registro a la base local
                            await BackupsRepo.Agregar(fileName);
                            fs.unlinkSync(backupPath); // Elimina el archivo localmente
                            escribirEstadoBackup(true);
                        }
                        else {
                            logger.error({
                                code: CodigoError.BACKUP_UPLOAD_ERROR,
                                message: `Ocurrió un error al intentar subir el archivo al servidor. ${resultado}`,
                                modulo: 'backupService',
                            });
                            escribirEstadoBackup(false);
                        }
                    } catch (error: any) {
                        logger.error({
                            code: CodigoError.BACKUP_UPLOAD_ERROR,
                            message: error.message || 'Error al subir el backup a AdminServer',
                            modulo: 'backupService',
                            cause: error?.cause?.message,
                            stack: error?.stack,
                        });
                        escribirEstadoBackup(false);
                    }

                    logger.info('Finalizó correctamente el proceso de respaldo.');
                });

            }
        }
        catch (error: any) {
            logger.error({
                code: CodigoError.CRON_INIT_ERROR,
                message: error.message || 'Error dentro del proceso cron de respaldo',
                modulo: 'backupService',
                stack: error?.stack,
            });
        }
    }
}

async function eliminarArchivo(filePath: string) {
    if (existsSync(filePath)) { // Verifica si el archivo existe
        try {
            await unlink(filePath); // Elimina el archivo
        } catch (error: any) {
            logger.error({
                code: CodigoError.BACKUP_GENERACION_ERROR,
                message: `Error al intentar eliminar el archivo previo: ${error.message || error}`,
                modulo: 'backupService',
                stack: error?.stack,
            });
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

        // Proceso externo: acumulamos stderr para usarlo como mensaje cuando
        // el error del proceso venga vacío (patrón estandar_errores.md §5.3 de EasySales).
        let stderrAcumulado = '';

        dumpProcess.stdout.pipe(output);

        dumpProcess.stderr.on('data', (data) => {
            stderrAcumulado += data.toString();
        });

        dumpProcess.on('close', (code) => {
            if (code === 0) {
                logger.info('Backup generado correctamente');
                resolve(true);
            } else {
                logger.error({
                    code: CodigoError.BACKUP_GENERACION_ERROR,
                    message: stderrAcumulado || `mysqldump finalizó con código: ${code}`,
                    modulo: 'backupService',
                });
                reject(new Error(stderrAcumulado || `mysqldump finalizó con código: ${code}`));
            }
        });

        dumpProcess.on('error', (err: any) => {
            logger.error({
                code: CodigoError.BACKUP_GENERACION_ERROR,
                message: err.message || stderrAcumulado || 'Error al lanzar mysqldump',
                modulo: 'backupService',
                stack: err?.stack,
            });
            reject(err);
        });
    });
}

export const BackupsServ = new BackupsService();