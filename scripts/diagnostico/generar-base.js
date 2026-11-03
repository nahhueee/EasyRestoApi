#!/usr/bin/env node
// scripts/diagnostico/generar-base.js
//
// USO ÚNICO — NO REGENERAR LA BASE.
//
// Genera UNA vez la migration base (src/db/tasks/20250101000000_schema_base.js) a
// partir de una base de referencia (--db diag_referencia, armada con el schema que tenía
// script.sql —ya eliminado— más las migrations). El archivo generado se commitea y queda CONGELADO: nunca se edita ni se
// vuelve a generar (architecture.md §13.1). Este script queda en el repo solo como trazabilidad
// de cómo se obtuvo; se niega a pisar un archivo existente.
//
// Uso: node scripts/diagnostico/generar-base.js --db diag_referencia [--out ruta.js]
//
// Qué hace:
//  - DDL: SHOW CREATE TABLE de cada tabla (menos knex_migrations*), sin DEFAULT CHARSET /
//    COLLATE / CHARACTER SET / AUTO_INCREMENT=n (heredan el default de la base). Conserva ENGINE=InnoDB y los nombres de constraints e índices.
//  - Orden de ejecución en la migration: tablas sin FKs -> semillas -> FKs (ALTER ... ADD).
//  - Semillas: contenido completo, con ids explícitos, de toda tabla con filas en la referencia.
//    Antes de generar verifica invariantes que las migrations viejas asumen (ver ASERCIONES).

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.resolve(REPO_ROOT, `config.${process.env.NODE_ENV || 'pc'}.json`);
const OUT_DEFAULT = path.resolve(REPO_ROOT, 'src', 'db', 'tasks', '20250101000000_schema_base.js');
const EXCLUIDAS = ['knex_migrations', 'knex_migrations_lock'];

function parsearArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--db') args.db = argv[++i];
    else if (argv[i] === '--out') args.out = path.resolve(argv[++i]);
    else throw new Error(`Argumento desconocido: ${argv[i]}`);
  }
  if (!args.db) throw new Error('Falta --db <base>. Uso: node generar-base.js --db diag_referencia');
  if (!args.db.startsWith('diag_')) {
    throw new Error(`Guardia de seguridad: --db="${args.db}" no empieza con "diag_".`);
  }
  args.out = args.out || OUT_DEFAULT;
  return args;
}

function limpiarColumna(linea) {
  return linea
    .replace(/ CHARACTER SET \w+/gi, '')
    .replace(/ COLLATE \w+/gi, '');
}

function limpiarOpciones(linea) {
  return linea
    .replace(/ DEFAULT CHARSET=\w+/i, '')
    .replace(/ CHARSET=\w+/i, '')
    .replace(/ COLLATE=\w+/i, '')
    .replace(/ AUTO_INCREMENT=\d+/i, '');
}

// Devuelve { create, fks[] } para una tabla.
function transformarCreate(tabla, ddl) {
  const lineas = ddl.split('\n');
  const cierre = lineas[lineas.length - 1];
  const defs = lineas.slice(1, -1).map(l => l.replace(/,\s*$/, '').trim());
  const fks = [];
  const resto = [];
  for (const d of defs) {
    if (/^CONSTRAINT `[^`]+` FOREIGN KEY/i.test(d)) {
      fks.push(`ALTER TABLE \`${tabla}\` ADD ${d}`);
    } else {
      resto.push('  ' + limpiarColumna(d));
    }
  }
  const create = [lineas[0], resto.join(',\n'), limpiarOpciones(cierre)].join('\n');
  return { create, fks };
}

// Invariantes que las migrations viejas y el código asumen de las semillas.
function verificarSemillas(sem) {
  const err = [];
  const filas = (t) => (sem[t] ? sem[t].filas : []);
  const ok = (cond, msg) => { if (!cond) err.push(msg); };

  const pi = filas('parametros_impresion');
  ok(pi.length === 1, 'parametros_impresion: debe tener exactamente 1 fila');

  const tp = filas('tipos_pago');
  const nombresTp = tp.map(f => f.nombre);
  for (const n of ['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA', 'COMBINADO']) {
    ok(nombresTp.includes(n), `tipos_pago: falta "${n}"`);
  }
  const ef = tp.find(f => f.nombre === 'EFECTIVO');
  ok(ef && ef.id === 1, 'tipos_pago: EFECTIVO debe tener id=1 (el código lo asume)');
  // estadisticasRepository suma por idTPago fijo: 1 efectivo, 2 tarjetas, 3 transferencias, 5 qr.
  const idDe = (n) => (tp.find(f => f.nombre === n) || {}).id;
  ok(idDe('TARJETA') === 2 && idDe('TRANSFERENCIA') === 3 && idDe('COMBINADO') === 4 && idDe('QR') === 5,
    'tipos_pago: los ids deben ser EFECTIVO=1, TARJETA=2, TRANSFERENCIA=3, COMBINADO=4, QR=5 (estadisticasRepository los asume)');

  const us = filas('usuarios');
  ok(us.length === 1 && us[0].nombre === 'ADMIN' && us[0].id === 1, 'usuarios: debe existir solo ADMIN con id=1');
  ok(us.every(u => typeof u.pass === 'string' && u.pass.startsWith('$2')),
    'usuarios: todas las passwords deben ser hash bcrypt ($2…); si no, la app no deja entrar (login server-side)');

  const cg = filas('cargos').map(f => f.id).sort();
  ok(JSON.stringify(cg) === JSON.stringify([1, 2]), 'cargos: deben existir los ids 1 (ADMINISTRADOR) y 2 (EMPLEADO)');
  const rl = filas('roles').map(f => f.id).sort();
  ok(JSON.stringify(rl) === JSON.stringify([1, 2, 3, 4]), 'roles: deben existir los ids 1 a 4');
  ok(filas('listas_precio').length === 2, 'listas_precio: deben existir 2 listas (RESTAURANT, PARA LLEVAR)');
  ok(filas('pedidos_tipo').length === 3, 'pedidos_tipo: deben existir 3 tipos (RESTAURANTE, RETIRA, DELIVERY)');
  ok(filas('categorias').some(c => c.nombre === 'SIN ASIGNAR'), 'categorias: falta "SIN ASIGNAR"');
  ok(filas('salones').length === 1, 'salones: debe existir el salón PRINCIPAL');
  ok(filas('mesas').some(m => m.codigo === 'NINGUNA'), 'mesas: falta la mesa "NINGUNA"');
  ok(filas('productos').length === 0, 'productos: no se siembra ningún producto (decisión D1: no existe VARIOS en EasyResto)');

  const claves = filas('parametros').map(f => f.clave);
  for (const c of ['version', 'modoTrabajo', 'actualizado']) ok(claves.includes(c), `parametros: falta la clave "${c}"`);

  if (err.length) throw new Error('Semillas no cumplen las invariantes:\n  - ' + err.join('\n  - '));
}

async function main() {
  const args = parsearArgs(process.argv.slice(2));
  if (fs.existsSync(args.out)) {
    throw new Error(
      `${args.out} ya existe. La migration base está CONGELADA: no se regenera ni se pisa. ` +
      'Si realmente hay que rehacerla, hacerlo a mano y fuera de este script, con review.'
    );
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).db;
  const con = await mysql.createConnection({
    host: cfg.host, user: cfg.user, password: cfg.password, database: args.db, dateStrings: true,
  });

  try {
    const [[{ db }]] = await con.query('SELECT DATABASE() AS db');
    if (db !== args.db) throw new Error(`Conectado a "${db}", esperaba "${args.db}".`);

    const [tablasRows] = await con.query(
      "SELECT TABLE_NAME AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    );
    const tablas = tablasRows.map(r => r.n).filter(n => !EXCLUIDAS.includes(n));

    const creates = [];
    const fks = [];
    const semillas = {};

    for (const t of tablas) {
      const [[fila]] = await con.query(`SHOW CREATE TABLE \`${t}\``);
      const ddl = fila['Create Table'];
      const { create, fks: f } = transformarCreate(t, ddl);
      creates.push(create);
      fks.push(...f);

      const [rows] = await con.query(`SELECT * FROM \`${t}\` ORDER BY 1`);
      if (rows.length) {
        for (const r of rows) {
          for (const [k, v] of Object.entries(r)) {
            if (Buffer.isBuffer(v)) throw new Error(`Valor binario en ${t}.${k}: no soportado por el generador.`);
          }
        }
        semillas[t] = { columnas: Object.keys(rows[0]), filas: rows.map(r => ({ ...r })) };
      }
    }

    for (const s of [...creates, ...fks]) {
      if (s.includes('?')) throw new Error('Un DDL contiene "?": knex.raw lo interpretaría como binding. Revisar a mano:\n' + s);
      if (/CHARACTER SET|COLLATE|CHARSET|AUTO_INCREMENT=/i.test(s)) throw new Error('Quedó CHARSET/COLLATE/AUTO_INCREMENT en el DDL:\n' + s);
    }
    verificarSemillas(semillas);

    const fecha = new Date().toISOString().slice(0, 10);
    const salida = plantilla({ args, fecha, tablas, creates, fks, semillas });
    fs.writeFileSync(args.out, salida, 'utf8');

    console.log(`Generado: ${args.out}`);
    console.log(`  Tablas: ${creates.length} | FKs: ${fks.length}`);
    console.log('  Tablas semilla (filas):');
    for (const [t, s] of Object.entries(semillas)) console.log(`    ${t}: ${s.filas.length}`);
  } finally {
    await con.end();
  }
}

function plantilla({ args, fecha, creates, fks, semillas }) {
  const j = (x) => JSON.stringify(x, null, 2);
  return `// MIGRATION BASE — CONGELADA. NO EDITAR. NO REGENERAR.
//
// Foto del schema objetivo de EasyResto (script.sql original + las migrations existentes),
// generada UNA vez el ${fecha} desde la base "${args.db}" con
// scripts/diagnostico/generar-base.js. Ese script queda solo como trazabilidad.
//
// Reglas (architecture.md §13.1):
//  - Esta migration no se edita ni se regenera nunca. Cambiar el schema = escribir otra migration.
//  - Una migration que ya corrió en algún ambiente no cambia su efecto; solo se le pueden agregar
//    guardas de idempotencia.
//  - Nunca fijar CHARSET ni COLLATE en un DDL: todo hereda el default de la base.
//
// Cómo funciona (todo o nada):
//  - Si existe la tabla \`pedidos\`  -> instalación existente: no-op. (Su timestamp es anterior a
//    todas las demás: knex la corre primero, pero en una base existente no hace nada.)
//  - Si la base no tiene NINGUNA tabla (ignorando knex_migrations*) -> crea todo + semillas.
//  - Cualquier otro caso (base a medias) -> error. Una base a medias es un error de instalación
//    y tiene que verse, no tolerarse con CREATE TABLE IF NOT EXISTS.
//
// Orden al crear: tablas sin FKs -> semillas (ids explícitos) -> FKs. Después corren las demás
// migrations, que sobre este schema son no-op (tienen guardas de existencia).

const TABLAS = ${j(creates)};

const FKS = ${j(fks)};

const SEMILLAS = ${j(semillas)};

const EXCLUIDAS = ['knex_migrations', 'knex_migrations_lock'];

exports.up = async function (knex) {
  const [filas] = await knex.raw(
    "SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
  );
  const existentes = filas.map((f) => f.nombre).filter((n) => !EXCLUIDAS.includes(n));

  if (existentes.includes('pedidos')) return; // instalación existente: no-op

  if (existentes.length > 0) {
    throw new Error(
      'schema_base: la base tiene ' + existentes.length + ' tabla(s) pero no tiene "pedidos" (' +
      existentes.slice(0, 5).join(', ') + (existentes.length > 5 ? ', …' : '') + '). ' +
      'Es una base a medias (instalación interrumpida o manipulada): no se continúa. ' +
      'Borrar la base y reinstalar.'
    );
  }

  for (const ddl of TABLAS) {
    await knex.raw(ddl);
  }

  for (const [tabla, semilla] of Object.entries(SEMILLAS)) {
    await knex(tabla).insert(semilla.filas);
  }

  for (const ddl of FKS) {
    await knex.raw(ddl);
  }
};

exports.down = async function () {
  // No-op a propósito: una migration nunca borra el schema completo.
};
`;
}

main().catch((err) => {
  console.error('\nFalló generar-base.js:');
  console.error(err.stack || err.message);
  process.exit(1);
});
