import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import config from './conf/app.config';
const http = require('http');
const path = require('path');
const app = express();
const server = http.createServer(app);

// SETTINGS
app.set('port', process.env.Port || config.port);
app.use(morgan("dev"));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// ARCHIVOS ESTÁTICOS DEL BACKEND
app.use(express.static(path.join(__dirname, 'upload')));

// RUTAS DE API
import estadisticasRuta from './routes/estadisticasRoute';
import actualizacionRuta from './routes/actualizacionRoute';
import usuariosRuta from './routes/usuariosRoute';
import categoriasRuta from './routes/categoriasRuta';
import productosVariedadRuta from './routes/productosRoute';
import parametrosRuta from './routes/parametrosRoute';
import logsRuta from './routes/logsRoute';
import servidorRuta from './routes/servidorRoute';
import pedidosRuta from './routes/pedidosRoute';
import mesasRuta from './routes/mesasRoute';
import adicionalesRuta from './routes/adicionalesRoute';
import listasRuta from './routes/listasPrecioRuta';
import salonesRuta from './routes/salonesRoute';
import cajasRuta from './routes/cajasRoute';
import movimientosRuta from './routes/movimientosRoute';
import miscRuta from './routes/miscRoute';

app.use('/easyresto/estadisticas', estadisticasRuta);
app.use('/easyresto/update', actualizacionRuta);
app.use('/easyresto/usuarios', usuariosRuta);
app.use('/easyresto/categorias', categoriasRuta);
app.use('/easyresto/productos', productosVariedadRuta);
app.use('/easyresto/parametros', parametrosRuta);
app.use('/easyresto/logs', logsRuta);
app.use('/easyresto/server', servidorRuta);
app.use('/easyresto/pedidos', pedidosRuta);
app.use('/easyresto/mesas', mesasRuta);
app.use('/easyresto/adicionales', adicionalesRuta);
app.use('/easyresto/listas-precio', listasRuta);
app.use('/easyresto/salones', salonesRuta);
app.use('/easyresto/cajas', cajasRuta);
app.use('/easyresto/movimientos', movimientosRuta);
app.use('/easyresto/misc', miscRuta);

// AdminServer
import adminServerRuta from './routes/adminRoute';
app.use('/easyresto/adminserver', adminServerRuta);

// Files
import filesRoute from './routes/filesRoute';
app.use('/easyresto/files', filesRoute);

// Backups
import backupRoute from './routes/backupRoute';
import {BackupsServ} from './services/backupService';
app.use('/easyresto/backup', backupRoute);
if (!config.web) BackupsServ.IniciarCron();

// Service Servidor
import {ServidorServ} from './services/servidorService';
if (!config.web) ServidorServ.IniciarModoServidor();

// AdminServer - Fase 1: heartbeat + reporte de errores en batch
import {HeartbeatServ} from './services/heartbeatService';
import {ErrorBatchServ} from './services/errorBatchService';
ErrorBatchServ.IniciarCron();
if (!config.web) HeartbeatServ.IniciarCron();

//GUARDAMOS LA IP PARA QUE LA PUEDA USAR IONIC
ServidorServ.GuardarInfoServidor(config.port);

// Ruta de prueba API
app.get('/easyresto', (req, res) => {
    res.status(200).send('Servidor de EasyResto funcionando en este puerto.');
});

// Fase 1 AdminServer - Trabajo 5: endpoints de diagnóstico que consume el
// frontend Tauri directamente (no pasan por adminRoute.ts). Calco de EasySalesApi.
import { ParametrosRepo } from './data/parametrosRepository';
const fsSync = require('fs');

app.get('/easyresto/version', async (req, res) => {
    return res.json({
        version: await ParametrosRepo.ObtenerParametros('version')
    });
});

// Expone el terminal_id al frontend para el gate de canary y telemetría.
// Devuelve { terminal } si terminal.json existe y está bien formado, o 404 si no hay terminal.
app.get('/easyresto/terminal', (req, res) => {
    const TERMINAL_FILE = path.join(process.cwd(), 'terminal.json');
    if (!fsSync.existsSync(TERMINAL_FILE)) {
        return res.status(404).json({ terminal: null });
    }
    try {
        const data = JSON.parse(fsSync.readFileSync(TERMINAL_FILE, 'utf-8'));
        if (!data.terminal) return res.status(404).json({ terminal: null });
        return res.json({ terminal: data.terminal });
    } catch {
        return res.status(404).json({ terminal: null });
    }
});

// NOTA: EasySalesApi también expone /pendiente y /forzar-descarga, respaldados
// por un pipeline real de descarga/aplicación/rollback de updates
// (updater/config/{Checkear,Descargar,Aplicar}Actualizacion.ts + EjecutarRollback.ts).
// Ese pipeline NO existe en EasyRestoApi — no se replica acá sin confirmar
// alcance y modelo de proceso (EasyResto no corre bajo PM2). Ver resumen de
// la sesión para la pregunta pendiente a Nahu.

// ARCHIVOS DE IONIC 
app.use(express.static(path.join(__dirname, "../www")));

// CUALQUIER RUTA NO API → APP IONIC
app.get('*', function(req, res) {
  if (
    req.originalUrl.includes('.js') ||
    req.originalUrl.includes('.css') ||
    req.originalUrl.includes('.map') ||
    req.originalUrl.includes('.json') ||
    req.originalUrl.startsWith('/assets')
  ) {
    // Dejar que el static lo maneje → evita romper Ionic
    res.status(404).end();
    return;
  }

  res.sendFile(path.join(__dirname, "../www/index.html"));
});

// Manejo de errores HTTP (Fase 1 AdminServer) - debe ir al final, después de
// todas las rutas. Solo las routes migradas usan next(error)/AppError; el
// resto del código legacy sigue respondiendo por su cuenta (sin barrido masivo).
import { errorMiddleware } from './middlewares/errorMiddleware';
app.use(errorMiddleware);

// START SERVER
let host = config.esServer ? "0.0.0.0" : "127.0.0.1";

server.listen(app.get('port'), host, () => {
    console.log('server ' + process.env.NODE_ENV + ' en puerto ' + app.get('port'));
});
