const path = require('path');
const fs = require('fs');
const env = process.env.NODE_ENV || 'pc';  // Si no se define NODE_ENV, por defecto 'pc'

// Rutas resueltas contra __dirname (no contra el cwd): knex corrido desde otra carpeta
// (instalador, updater) tiene que leer la misma config y las mismas migrations.
const configFile = path.resolve(__dirname, `config.${env}.json`);
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

module.exports = {
  development: {
      client: 'mysql2', 
      connection: {
        host: config.db.host,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database
      },
      migrations: {
        directory: path.resolve(__dirname, 'src/db/tasks'),  // Ruta donde se generan y almacenan las migraciones
      },
      seeds: {
        directory: path.resolve(__dirname, 'src/db/seeds')  // Ruta para los archivos de seeds
      }
    }
};
  