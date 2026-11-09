// Migration (DDL): agrega `sector` y `controlaStock` a `productos`.
// Ver documentos/handoff_rework_productos_comandas.md, PR1 §1.1.
//
// Reemplaza la elección "elaborado / terciarizado" por dos atributos que el comerciante entiende:
// dónde se prepara (sector) y si controla stock (controlaStock). `productos.tipo` NO se toca
// (expand-contract, architecture.md §13): se mantiene derivado de `sector` desde el backend.
//
// VARCHAR y no ENUM, igual que productos_precio.posicionDes; la validación de valores va en el backend.
// Los datos (terciarizado -> barra/1) se migran en la migration siguiente (DDL y datos van separados).
//
// Idempotente: cada columna se agrega solo si falta.

exports.up = async function (knex) {
  const tieneSector = await knex.schema.hasColumn('productos', 'sector');
  const tieneControlaStock = await knex.schema.hasColumn('productos', 'controlaStock');
  if (tieneSector && tieneControlaStock) return;

  await knex.schema.alterTable('productos', (table) => {
    if (!tieneSector) table.string('sector', 10).notNullable().defaultTo('cocina');
    if (!tieneControlaStock) table.boolean('controlaStock').notNullable().defaultTo(false);
  });
};

exports.down = async function (knex) {
  const tieneSector = await knex.schema.hasColumn('productos', 'sector');
  const tieneControlaStock = await knex.schema.hasColumn('productos', 'controlaStock');
  if (!tieneSector && !tieneControlaStock) return;

  await knex.schema.alterTable('productos', (table) => {
    if (tieneSector) table.dropColumn('sector');
    if (tieneControlaStock) table.dropColumn('controlaStock');
  });
};
