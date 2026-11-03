#!/usr/bin/env node
// scripts/diagnostico/comparar-bases.js
//
// Compara el schema de dos bases del mismo servidor (config.<env>.json): SHOW CREATE TABLE de cada
// tabla, normalizado (sin AUTO_INCREMENT=n, CHARSET ni COLLATE), ignorando knex_migrations*.
// Con --semillas compara además el contenido completo de las tablas que tienen filas en la base A
// (pensado para "instalación nueva" vs "referencia"; NO usar con bases de clientes, que tienen datos).
//
// Uso: node scripts/diagnostico/comparar-bases.js --a diag_referencia --b diag_ref_nueva [--semillas]
//      Las dos bases tienen que empezar con "diag_" (solo lectura, pero evita apuntar a producción).
//
// Salida: exit 0 si son idénticas, exit 1 si hay diferencias (se listan).

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.resolve(REPO_ROOT, `config.${process.env.NODE_ENV || 'pc'}.json`);
const EXCLUIDAS = ['knex_migrations', 'knex_migrations_lock'];

function args() {
  const a = { semillas: false };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--a') a.a = v[++i];
    else if (v[i] === '--b') a.b = v[++i];
    else if (v[i] === '--semillas') a.semillas = true;
    else throw new Error(`Argumento desconocido: ${v[i]}`);
  }
  for (const k of ['a', 'b']) {
    if (!a[k] || !a[k].startsWith('diag_')) throw new Error(`--${k} es obligatorio y tiene que empezar con "diag_".`);
  }
  return a;
}

const normalizar = (ddl) => ddl
  .replace(/ AUTO_INCREMENT=\d+/gi, '')
  .replace(/ DEFAULT CHARSET=\w+/gi, '')
  .replace(/ COLLATE=\w+/gi, '')
  .replace(/ CHARACTER SET \w+/gi, '')
  .replace(/ COLLATE \w+/gi, '');

async function leer(cfg, base, conSemillas) {
  const con = await mysql.createConnection({ ...cfg, database: base, dateStrings: true });
  try {
    const [t] = await con.query(
      "SELECT TABLE_NAME AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
    const out = {};
    for (const { n } of t) {
      if (EXCLUIDAS.includes(n)) continue;
      const [[f]] = await con.query(`SHOW CREATE TABLE \`${n}\``);
      out[n] = { ddl: normalizar(f['Create Table']) };
      if (conSemillas) {
        const [rows] = await con.query(`SELECT * FROM \`${n}\` ORDER BY 1`);
        out[n].filas = JSON.stringify(rows);
        out[n].cant = rows.length;
      }
    }
    return out;
  } finally {
    await con.end();
  }
}

async function main() {
  const a = args();
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).db;
  const conn = { host: cfg.host, user: cfg.user, password: cfg.password };
  const A = await leer(conn, a.a, a.semillas);
  const B = await leer(conn, a.b, a.semillas);

  const dif = [];
  for (const t of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (!A[t]) { dif.push(`Solo en ${a.b}: tabla ${t}`); continue; }
    if (!B[t]) { dif.push(`Solo en ${a.a}: tabla ${t}`); continue; }
    if (A[t].ddl !== B[t].ddl) dif.push(`DDL distinto en ${t}:\n  ${a.a}: ${A[t].ddl.replace(/\n/g, '\n    ')}\n  ${a.b}: ${B[t].ddl.replace(/\n/g, '\n    ')}`);
    if (a.semillas && A[t].cant > 0 && A[t].filas !== B[t].filas) {
      dif.push(`Semillas distintas en ${t} (${a.a}: ${A[t].cant} filas, ${a.b}: ${B[t].cant} filas)`);
    }
  }

  console.log(`Comparadas ${Object.keys(A).length} tablas (${a.a}) vs ${Object.keys(B).length} (${a.b})${a.semillas ? ' + semillas' : ''}.`);
  if (dif.length === 0) { console.log('IDÉNTICAS.'); return; }
  console.log(`\n${dif.length} diferencia(s):\n`);
  for (const d of dif) console.log('- ' + d + '\n');
  process.exit(1);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
