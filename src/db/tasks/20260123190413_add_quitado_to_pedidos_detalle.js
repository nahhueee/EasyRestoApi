// RESTAURADA del histórico (Actualizacion/backend). Esta migration ya corrió en bases de clientes y knex
// exige que su archivo exista (si falta: "migration directory is corrupt"). Solo se le agregaron guardas
// de idempotencia (y sintaxis CJS) para que sea no-op sobre el schema final de la migration base.
// Su efecto donde ya corrió no cambia.

exports.up = async function (knex) {
  if (await knex.schema.hasColumn('pedidos_detalle', 'quitado')) return; // guarda
  await knex.schema.alterTable('pedidos_detalle', table => {
    table
      .integer('quitado')
      .notNullable()
      .defaultTo(0);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('pedidos_detalle', table => {
    table.dropColumn('quitado');
  });
};
