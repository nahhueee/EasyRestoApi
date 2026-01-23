exports.up = function (knex) {
  return knex.schema.alterTable('pedidos_detalle', table => {
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
