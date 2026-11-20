// Migration: anulacion de movimientos de caja (en lugar de borrarlos).
// Un movimiento anulado queda en el historial y apunta (idMovimientoCompensado) al
// movimiento inverso que lo compensa. NULL = movimiento vigente.
// Los movimientos existentes quedan en NULL (vigentes). Sin FK a proposito: el borrado
// fisico (Eliminar) ya no se usa desde el front, pero no queremos que una FK lo trabe.

exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('cajas_movimientos', 'idMovimientoCompensado');
  if (existe) return;
  await knex.schema.alterTable('cajas_movimientos', (t) => {
    t.integer('idMovimientoCompensado').unsigned().nullable();
    t.index('idMovimientoCompensado', 'idx_cajas_mov_compensado'); // lo usa el EXISTS de esAnulacion al listar
  });
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('cajas_movimientos', 'idMovimientoCompensado');
  if (!existe) return;
  await knex.schema.alterTable('cajas_movimientos', (t) => {
    t.dropIndex('idMovimientoCompensado', 'idx_cajas_mov_compensado');
    t.dropColumn('idMovimientoCompensado');
  });
};
