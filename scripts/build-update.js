const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const zip = new AdmZip();

// Código compilado
zip.addLocalFolder('out/src', 'src');

/**
 * App Ionic de mozos.
 * DIVERGENCIA CON EasySalesApi: allá el update.zip solo lleva src/ + package.json.
 * EasyResto sirve la app mobile de los mozos desde <root>/www (express.static en
 * src/index.ts), así que si no viaja en el zip los mozos nunca se actualizarían
 * por el updater. Se incluye siempre, por decisión explícita.
 *
 * Consecuencia: AplicarActualizacion y EjecutarRollback también respaldan y
 * restauran www/, si no un rollback dejaría src viejo con www nuevo.
 */
if (fs.existsSync('out/www')) {
  zip.addLocalFolder('out/www', 'www');
} else {
  console.warn('⚠️  No se encontró out/www — el zip no va a incluir la app de mozos');
}

// Package.json
zip.addLocalFile(pkgPath);

// ZIP único (temporal)
const zipPath = path.resolve('update.zip');
zip.writeZip(zipPath);

const tamanoMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
console.log(`📦 ZIP generado: ${zipPath} (${tamanoMb} MB) — v${pkg.version}`);

// El bootstrap aplica en el mismo arranque (auto-apply) solo si el ZIP pesa
// menos de 50 MB. Avisamos cuando se pasa para que no sorprenda el doble reinicio.
if (Number(tamanoMb) >= 50) {
  console.warn('⚠️  El ZIP supera los 50 MB: no va a haber auto-apply, se aplica en el arranque siguiente');
}
