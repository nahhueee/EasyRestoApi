// Migration: flag `verificarImpresora` en `parametros_impresion`.
//
// 1 = antes de imprimir se consulta a Windows si la impresora está fuera de línea.
// 0 = no se consulta (se manda directo al spooler).
// El chequeo (PowerShell + WMI) demora 5-7 s en equipos lentos, así que queda APAGADO por defecto
// hasta tener una implementación rápida. Se cambia por SQL, no tiene pantalla. Idempotente.

exports.up = async function (knex) {
  if (await knex.schema.hasColumn('parametros_impresion', 'verificarImpresora')) return;

  await knex.schema.alterTable('parametros_impresion', (table) => {
    table.integer('verificarImpresora').notNullable().defaultTo(0);
  });
};

exports.down = async function (knex) {
  if (!(await knex.schema.hasColumn('parametros_impresion', 'verificarImpresora'))) return;

  await knex.schema.alterTable('parametros_impresion', (table) => {
    table.dropColumn('verificarImpresora');
  });
};
