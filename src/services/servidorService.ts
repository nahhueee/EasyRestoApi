import dgram from 'dgram';
import os from 'os';
import {AdminServ} from '../services/adminService';
import logger from '../log/logger';
import { CodigoError } from '../log/CodigosError';
import config, { configFilePath } from '../conf/app.config';
import path from 'path';
import { exec } from 'child_process';
//import isOnline from 'is-online';
const fs = require("fs-extra");

let udpServer;
const udpPort = 41234;

class ServidorService {

  /**
   * Persiste esServer en config.pc.json y reinicia PM2 para que tome efecto.
   *
   * Por qué hace falta el restart y no alcanza con mutar `config.esServer` en memoria:
   * el host de escucha del server (127.0.0.1 vs 0.0.0.0, ver index.ts) se decide una sola
   * vez en server.listen() al bootear el proceso. Node no puede re-bindear el socket a otro
   * host sin reiniciar.
   *
   * Antes esto lo hacía el front (Tauri, comando Rust change_config_reset) escribiendo el
   * archivo directo, asumiendo que `app` y `server` son carpetas hermanas — supuesto que se
   * rompe según cómo se instale el front. Se movió acá porque el backend siempre sabe resolver
   * su propio config.pc.json (ver configFilePath en app.config.ts), sin depender de dónde ni
   * cómo esté instalado el front.
   */
  async CambiarModoServidor(valor: boolean): Promise<void> {
    try {
      config.esServer = valor;

      await fs.writeJson(configFilePath, config, { spaces: 2 });

      logger.info(`Modo servidor actualizado a ${valor}, reiniciando PM2...`);

      // Se agenda el restart en vez de ejecutarlo ya mismo: así el caller (la ruta HTTP)
      // llega a mandar la respuesta OK antes de que el proceso se reinicie.
      setTimeout(() => this.RestartPm2(), 800);

    } catch (error: any) {
      logger.error({
          code:    CodigoError.INTERNAL_ERROR,
          message: error.message || 'Error al cambiar el modo servidor',
          modulo:  'servidorService.CambiarModoServidor',
          stack:   error?.stack,
      });
      throw error;
    }
  }

  // Público: lo usa CambiarModoServidor() y también servidorRoute.ts POST /reiniciar
  // (reinicio manual tras descargar una actualización de backend, ver actualizacion.component.ts).
  RestartPm2(): void {
    const home = process.env.USERPROFILE || '';
    const pm2Path = `${home}\\AppData\\Roaming\\npm\\pm2.cmd`;

    exec(`"${pm2Path}" restart easyresto`, (error, stdout, stderr) => {
      if (error) {
        logger.error({
            code:    CodigoError.INTERNAL_ERROR,
            message: `PM2 no pudo reiniciar easyresto: ${stderr || error.message}`,
            modulo:  'servidorService.RestartPm2',
        });
      }
    });
  }

  GuardarInfoServidor(puerto:string) {
  const filePath = path.join(__dirname, '../../www/server-info.json');


    const data = {
      ip: getLocalIPAddress(),
      puerto: puerto,
      fecha: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  async IniciarModoServidor(){
      try{
          //Identidad de terminal: archivo local (igual que heartbeatService/errorBatchService)
          const terminalFile = path.join(process.cwd(), 'terminal.json');
          const terminal = fs.existsSync(terminalFile)
              ? (JSON.parse(await fs.readFile(terminalFile, 'utf-8')).terminal ?? null)
              : null;

          if(terminal){

            //Verificamos que este conectado a internet
            // const conectado = await isOnline();
            // if(!conectado) return;

            //Verificamos que la terminal este habilitada para usar este modo
            const habilitado = await AdminServ.ObtenerHabilitacion(terminal)
            if (!habilitado) {
                this.StopUDPDiscovery(false);

                //Si esta activo, pero el usuario ya no esta habilitado, cambiamos el estado de la variable en el config
                if(config.esServer){
                  //#region Cambiar la propiedad 'esServer' a false en el archivo de configuración
                  const configFilePath = path.resolve(__dirname, '../../config.pc.json');
                  
                  const rawConfig = await fs.readFile(configFilePath, 'utf-8');
                  const configuracion = JSON.parse(rawConfig);

                  configuracion.esServer = false;

                  // Guardar los cambios en el archivo de configuración
                  await fs.writeFile(configFilePath, JSON.stringify(configuracion, null, 2), 'utf-8');

                  logger.info('Se desactivó la clave en el servidor.');
                  //#endregion
                }

                return;
            }

            
          }

          if(config.esServer){
              this.StartUDPDiscovery();
            }else{
              this.StopUDPDiscovery(false);
            }
                
      } catch(error:any){
          logger.error({ code: CodigoError.INTERNAL_ERROR, message: 'Error al intentar iniciar el modo servidor. ' + error.message, modulo: 'servidorService.IniciarModoServidor', stack: error?.stack });
      }
  }

  async StartUDPDiscovery(): Promise<boolean> {
    if (udpServer) {
      return false;
    }

    udpServer = dgram.createSocket('udp4');

    udpServer.on('message', async (msg, rinfo) => {
      if (msg.toString() === 'DISCOVER_SERVER') {
        const response = Buffer.from(`DISCOVERY_RESPONSE|${getLocalIPAddress()}|7600`);
        udpServer.send(response, rinfo.port, rinfo.address);
      }
    });

    udpServer.on('error', (err) => {
      logger.error({ code: CodigoError.INTERNAL_ERROR, message: 'Error al intentar iniciar UDP: ' + err, modulo: 'servidorService.StartUDPDiscovery' });
      this.StopUDPDiscovery(true); 
    });

    try {
      await new Promise<void>((resolve, reject) => {
        udpServer!.bind(udpPort, () => {
          logger.info(`Discovery habilitado en el puerto ${udpPort}`);
          resolve();
        });
      });
      return true;
    } catch (error) {
        throw error;
    }
  }

  StopUDPDiscovery(error: boolean = false): boolean {
    if (udpServer) {
      udpServer.close(() => {
        logger.info(error ? 'Discovery detenido por error' : 'Discovery detenido manualmente');
      });
      udpServer = undefined;
      return true;
    }       
    return false;
  }
}

export const ServidorServ = new ServidorService();



function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        return config.address;
      }
    }
  }
  return '127.0.0.1';
}
