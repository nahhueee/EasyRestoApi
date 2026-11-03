// RESTAURADA del histórico (Actualizacion/backend). Esta migration ya corrió en bases de clientes y knex
// exige que su archivo exista (si falta: "migration directory is corrupt"). Solo se le agregaron guardas
// de idempotencia (y sintaxis CJS) para que sea no-op sobre el schema final de la migration base.
// Su efecto donde ya corrió no cambia.

exports.up = async function (knex) {
  if (await knex.schema.hasTable('parametros_mobile')) return; // guarda

  await knex.schema.createTable('parametros_mobile', (table) => {
    table.integer('imagenes').defaultTo(0);
    table.integer('todasMesas').defaultTo(0);
    table.integer('impComprobante').defaultTo(0);
  });

  await knex('parametros_mobile').insert({
    imagenes: 0,
    todasMesas: 0,
    impComprobante: 0
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('parametros_mobile');
};
