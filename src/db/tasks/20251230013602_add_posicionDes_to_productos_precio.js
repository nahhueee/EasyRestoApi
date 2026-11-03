// RESTAURADA del histórico (Actualizacion/backend). Esta migration ya corrió en bases de clientes y knex
// exige que su archivo exista (si falta: "migration directory is corrupt"). Solo se le agregaron guardas
// de idempotencia (y sintaxis CJS) para que sea no-op sobre el schema final de la migration base.
// Su efecto donde ya corrió no cambia.

exports.up = async function (knex) {
  if (await knex.schema.hasColumn('productos_precio', 'posicionDes')) return; // guarda
  await knex.schema.alterTable('productos_precio', function (table) {
    table.string('posicionDes', 10).defaultTo('izquierda');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('productos_precio', function (table) {
    table.dropColumn('posicionDes');
  });
};
