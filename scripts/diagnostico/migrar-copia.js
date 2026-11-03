#!/usr/bin/env node
// scripts/diagnostico/migrar-copia.js
//
// V4: corre knex migrate:latest sobre una COPIA de la base de un cliente (restaurada como diag_*)
// y verifica que los conteos de filas no cambien. Muestra qué migrations estaban pendientes.
//
// Uso: node scripts/diagnostico/migrar-copia.js --db diag_cliente1

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const knexLib = require('knex');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.resolve(REPO_ROOT, `config.${process.env.NODE_ENV || 'pc'}.json`);
const MIGRATIONS_DIR = path.resolve(REPO_ROOT, 'src', 'db', 'tasks');

const i = process.argv.indexOf('--db');
const db = i > -1 ? process.argv[i + 1] : null;
if (!db || !db.startsWith('diag_')) {
  console.error('Uso: node scripts/diagnostico/migrar-copia.js --db diag_<nombre>   (el prefijo diag_ es obligatorio)');
  process.exit(1);
}

async function conteos(con) {
  const [t] = await con.query(
    "SELECT TABLE_NAME AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY 1");
  const out = {};
  for (const { n } of t) {
    if (n.startsWith('knex_migrations')) continue;
    const [[r]] = await con.query(`SELECT COUNT(*) AS c FROM \`${n}\``);
    out[n] = r.c;
  }
  return out;
}

(async () => {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).db;
  const con = await mysql.createConnection({ host: cfg.host, user: cfg.user, password: cfg.password, database: db });
  const knex = knexLib({
    client: 'mysql2',
    connection: { host: cfg.host, user: cfg.user, password: cfg.password, database: db },
    migrations: { directory: MIGRATIONS_DIR },
  });
  try {
    const [[{ x }]] = await con.query('SELECT DATABASE() AS x');
    if (x !== db) throw new Error(`Conectado a "${x}", esperaba "${db}".`);
    const antes = await conteos(con);
    const [, pendientes] = await knex.migrate.list();
    console.log(`Pendientes antes de migrar (${pendientes.length}):`);
    for (const p of pendientes) console.log('  - ' + (p.file || p.name || p));
    const [batch, log] = await knex.migrate.latest();
    console.log(`\nBatch ${batch}: ${log.length} aplicada(s):`);
    for (const l of log) console.log('  OK ' + l);
    const despues = await conteos(con);
    const dif = Object.keys({ ...antes, ...despues }).filter((t) => antes[t] !== despues[t]);
    console.log('\nConteos de filas: ' + (dif.length ? 'CAMBIARON' : 'sin cambios'));
    for (const t of dif) console.log(`  ${t}: ${antes[t]} -> ${despues[t]}`);
    const [[{ c }]] = await con.query("SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'");
    if (c !== 1) throw new Error('La copia no tiene la tabla pedidos: no parece una base de EasyResto.');
  } finally {
    await knex.destroy();
    await con.end();
  }
})().catch((e) => { console.error('\nFalló migrar-copia.js:\n' + (e.stack || e.message)); process.exit(1); });
