exports.up = function (knex) {
  return knex.schema.alterTable('productos_precio', function (table) {
    table.string('posicionDes', 10).defaultTo('izquierda');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('productos_precio', function (table) {
    table.dropColumn('posicionDes');
  });
};
