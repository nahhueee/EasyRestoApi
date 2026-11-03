// RESTAURADA del histórico (Actualizacion/backend). Esta migration ya corrió en bases de clientes y knex
// exige que su archivo exista (si falta: "migration directory is corrupt"). Solo se le agregaron guardas
// de idempotencia (y sintaxis CJS) para que sea no-op sobre el schema final de la migration base.
// Su efecto donde ya corrió no cambia.

exports.up = async function (knex) {
  // Guarda: la versión original hacía dropTableIfExists + createTable, lo que sobre una base que
  // ya tiene la tabla (schema final, o cliente con la tabla configurada) la pisaba.
  if (await knex.schema.hasTable('parametros_impresion')) return;

  await knex.schema.createTable('parametros_impresion', (table) => {
    table.string('impresora', 100);
    table.string('papel', 10);
    table.integer('margenIzq').defaultTo(0);
    table.integer('margenDer').defaultTo(0);
    table.string('nomLocal', 100);
    table.string('desLocal', 100);
    table.string('dirLocal', 150);
  });

  await knex('parametros_impresion').insert({
    impresora: '',
    papel: '58mm',
    margenIzq: 0,
    margenDer: 0,
    nomLocal: 'EASY RESTO',
    desLocal: '',
    dirLocal: ''
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('parametros_impresion');
};
