import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import config from './conf/app.config';
const http = require('http');
const path = require('path');
const app = express();
const server = http.createServer(app);

//setings
app.set('port', process.env.Port || config.port);
app.use(morgan("dev"));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'upload')));

//Starting the server
let host:string = "127.0.0.1";
if(config.esServer){
    host = "0.0.0.0";
}

server.listen(app.get('port'), host, () => {
    console.log('server ' + process.env.NODE_ENV + ' en puerto ' + app.get('port'));
});

//#region Rutas
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
import miscRuta from './routes/miscRoute';

app.use('/easyresto/estadisticas', estadisticasRuta)
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
app.use('/easyresto/misc', miscRuta);


//AdminServer Route
import adminServerRuta from './routes/adminRoute';
app.use('/easyresto/adminserver', adminServerRuta);

//Files Route
import filesRoute from './routes/filesRoute';
app.use('/easyresto/files', filesRoute);
//#endregion

//#region backups 
import backupRoute from './routes/backupRoute';
import {BackupsServ} from './services/backupService';
app.use('/easyresto/backup', backupRoute);
BackupsServ.IniciarCron();
//#endregion

//Service Servidor
import {ServidorServ} from './services/servidorService';
ServidorServ.IniciarModoServidor();

//Index Route
app.get('/easyresto', (req, res) => {
    res.status(200).send('Servidor de EasyResto funcionando en este puerto.');
});
 
//404
app.use((_req, res) => {
    res.status(404).send('No se encontró el recurso solicitado.');
});
  

