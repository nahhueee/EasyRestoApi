// Migration: número de ticket corto por caja (`pedidos.nroTicket`) y parámetro `cobroRapido`.
// Ver documentos/diseno_ticket_mostrador_easyresto.md.
//
// nroTicket  : NULL en pedidos viejos (la UI y los comprobantes muestran `nroTicket ?? id`).
//              Se asigna al crear el pedido, reinicia por caja (o por día si idCaja = 0).
// cobroRapido: 'true' | 'false'. Habilita el botón "Guardar y cobrar" en la carga de pedido.
//
// Idempotente: chequea si la columna, el índice y la fila ya existen antes de crearlos.

const INDICE = 'idx_pedidos_nroticket';

exports.up = async function (knex) {
  const tieneColumna = await knex.schema.hasColumn('pedidos', 'nroTicket');
  if (!tieneColumna) {
    await knex.schema.alterTable('pedidos', (table) => {
      table.integer('nroTicket').nullable();
    });
  }

  const [indices] = await knex.raw('SHOW INDEX FROM pedidos WHERE Key_name = ?', [INDICE]);
  if (indices.length === 0) {
    await knex.schema.alterTable('pedidos', (table) => {
      table.index(['idCaja', 'fecha', 'nroTicket'], INDICE);
    });
  }

  const existe = await knex('parametros').where({ clave: 'cobroRapido' }).first();
  if (!existe) {
    await knex('parametros').insert({ clave: 'cobroRapido', valor: 'false' });
  }
};

exports.down = async function (knex) {
  const [indices] = await knex.raw('SHOW INDEX FROM pedidos WHERE Key_name = ?', [INDICE]);
  if (indices.length > 0) {
    await knex.schema.alterTable('pedidos', (table) => {
      table.dropIndex(['idCaja', 'fecha', 'nroTicket'], INDICE);
    });
  }

  const tieneColumna = await knex.schema.hasColumn('pedidos', 'nroTicket');
  if (tieneColumna) {
    await knex.schema.alterTable('pedidos', (table) => {
      table.dropColumn('nroTicket');
    });
  }

  await knex('parametros').where({ clave: 'cobroRapido' }).del();
};
