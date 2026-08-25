const fs = require("fs-extra");
const path = require("path");
require('dotenv').config();

async function setup() {
  try {
    console.log("📂 Creando carpetas...");

    // Definir las carpetas necesarias
    const directories = [
      "out/src/upload",
      "out/src/temp",
      "out/src/db/seeds",
      "out/src/db/tasks",
      "out/src/certs",
      "out/src/fonts",
      "out/www",
      // El logger del updater escribe updater/actualizaciones.log y winston no
      // crea el directorio: tiene que existir en el deploy.
      "out/updater",
      "out/updater/downloads"
    ];

    // Crear todas las carpetas
    for (const dir of directories) {
      await fs.ensureDir(dir);
    }

    console.log("✅ Carpetas creadas correctamente.");

    console.log("📂 Copiando archivos...");

    
    // Definir archivos individuales
    const filesToCopy = [
      "package.json",
      // package-lock.json: no lo necesita el server en runtime, pero sí "npm ci"
      // cuando build:server-installer instala node_modules directo en out/.
      "package-lock.json",
      ".env",
      "knexfile.js",
      "src/db/script.sql",
      // Variante no destructiva de script.sql, para el bootstrap de la base desde
      // el instalador de servidor (Instalador/scripts/setup-mysql-bootstrap.ps1).
      "src/db/script-bootstrap.sql",
      "src/fonts/Roboto-Italic.ttf",
      "src/fonts/Roboto-Medium.ttf",
      "src/fonts/Roboto-Regular.ttf",
      "src/fonts/Roboto-MediumItalic.ttf",
    ];

    //Archivo de configuracion dependiendo el entorno
    const env = process.env.NODE_ENV || 'pc';  
    const configFile = `config.${env}.json`;  
    filesToCopy.push(configFile);

    // Copiar archivos individuales. Se saltea el que no exista en vez de abortar:
    // .env no está versionado y no todas las máquinas de build lo tienen.
    for (const file of filesToCopy) {
      if (await fs.pathExists(file)) {
        await fs.copy(file, path.join("out", file));
      }
    }

    // Copiar toda la carpeta tasks
    await fs.copy("src/db/tasks", "out/src/db/tasks");

    // node_modules NO se copia acá a propósito: este setup.js corre como parte de
    // "npm run build", que también usa el updater incremental (scripts/release.js +
    // build-update.js). Meter node_modules en TODOS los builds sería tiempo perdido
    // en cada release normal. El instalador de servidor, que sí los necesita, corre
    // "npm ci" directo sobre out/ como paso aparte — ver "build:server-installer".

    //#region Cambiar la propiedad 'produccion' a true en el archivo de configuración
    const configFilePath = path.resolve(__dirname, `out/${configFile}`);
    
    const rawConfig = await fs.readFile(configFilePath, 'utf-8');
    const config = JSON.parse(rawConfig);

    config.produccion = true;

    // Guardar los cambios en el archivo de configuración
    await fs.writeFile(configFilePath, JSON.stringify(config, null, 2), 'utf-8');
    //#endregion

    console.log("✅ Archivos copiados correctamente.");
  } catch (error) {
    console.error("❌ Error en la configuración:", error);
  }
}


setup();
