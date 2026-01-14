exports.up = async function (knex) {
  // 1. Agregar columnas si no existen
  const hasIcono = await knex.schema.hasColumn('tipos_pago', 'icono');
  const hasColor = await knex.schema.hasColumn('tipos_pago', 'color');
  const hasOrden = await knex.schema.hasColumn('tipos_pago', 'orden');

  await knex.schema.alterTable('tipos_pago', table => {
    if (!hasIcono) table.string('icono', 15);
    if (!hasColor) table.string('color', 15);
    if (!hasOrden) table.integer('orden');
  });

  // 2. Actualizar los tipos que ya existían
  await knex('tipos_pago')
    .where('nombre', 'EFECTIVO')
    .update({ icono: 'monetization_on', color: '#2dc051', orden: 1 });

  await knex('tipos_pago')
    .where('nombre', 'TRANSFERENCIA')
    .update({ icono: 'account_balance', color: '#2db6c8', orden: 2 });

  await knex('tipos_pago')
    .where('nombre', 'TARJETA')
    .update({ icono: 'credit_card', color: '#ee8b29', orden: 4 });

  await knex('tipos_pago')
    .where('nombre', 'COMBINADO')
    .update({ icono: 'autorenew', color: '#7d7d7d', orden: 5 });

  // 3. Insertar QR si no existe
  const qrExiste = await knex('tipos_pago')
    .where('nombre', 'QR')
    .first();

  if (!qrExiste) {
    await knex('tipos_pago').insert({
      nombre: 'QR',
      icono: 'qr_code',
      color: '#fc7b9b',
      orden: 3
    });
  }
};

exports.down = async function (knex) {
  // rollback conservador (no borra datos históricos)
  await knex.schema.alterTable('tipos_pago', table => {
    table.dropColumn('icono');
    table.dropColumn('color');
    table.dropColumn('orden');
  });
};
