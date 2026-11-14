// Migration: flag `verificarImpresora` en `parametros_impresion`.
//
// 1 = antes de imprimir se consulta a Windows si la impresora está fuera de línea (comportamiento actual).
// 0 = no se consulta (se manda directo al spooler). Pensado para equipos lentos donde el chequeo
//     (PowerShell + WMI) demora varios segundos. Se cambia por SQL, no tiene pantalla.
//
// DEFAULT 1 para que todos los clientes sigan igual que hoy. Idempotente.

exports.up = async function (knex) {
  if (await knex.schema.hasColumn('parametros_impresion', 'verificarImpresora')) return;

  await knex.schema.alterTable('parametros_impresion', (table) => {
    table.integer('verificarImpresora').notNullable().defaultTo(1);
  });
};

exports.down = async function (knex) {
  if (!(await knex.schema.hasColumn('parametros_impresion', 'verificarImpresora'))) return;

  await knex.schema.alterTable('parametros_impresion', (table) => {
    table.dropColumn('verificarImpresora');
  });
};
