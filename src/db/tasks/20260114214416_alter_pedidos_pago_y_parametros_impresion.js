/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('pedidos_pago', table => {
    table.string('tipoRecDes', 10).defaultTo('Porcentaje');
    table.decimal('descuento', 10, 2).alter();
    table.decimal('recargo', 10, 2).alter();
  });

  await knex.schema.alterTable('parametros_impresion', table => {
    table.boolean('comandaDoble').defaultTo(false);
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('pedidos_pago', table => {
    table.dropColumn('tipoRecDes');
    table.decimal('descuento', 4, 2).alter();
    table.decimal('recargo', 4, 2).alter();
  });

  await knex.schema.alterTable('parametros_impresion', table => {
    table.dropColumn('comandaDoble');
  });
};
