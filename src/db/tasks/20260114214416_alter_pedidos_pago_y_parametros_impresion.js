// RESTAURADA del histórico (Actualizacion/backend). Esta migration ya corrió en bases de clientes y knex
// exige que su archivo exista (si falta: "migration directory is corrupt"). Solo se le agregaron guardas
// de idempotencia (y sintaxis CJS) para que sea no-op sobre el schema final de la migration base.
// Su efecto donde ya corrió no cambia.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  const hasTipoRecDes = await knex.schema.hasColumn('pedidos_pago', 'tipoRecDes');
  await knex.schema.alterTable('pedidos_pago', table => {
    if (!hasTipoRecDes) table.string('tipoRecDes', 10).defaultTo('Porcentaje');
    table.decimal('descuento', 10, 2).alter();
    table.decimal('recargo', 10, 2).alter();
  });

  if (!(await knex.schema.hasColumn('parametros_impresion', 'comandaDoble'))) {
    await knex.schema.alterTable('parametros_impresion', table => {
      table.boolean('comandaDoble').defaultTo(false);
    });
  }
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
