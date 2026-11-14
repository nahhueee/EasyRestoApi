// Migration: preferencia de impresion `nroTicketGrande` (parametros_impresion).
// Ver documentos/diseno_ticket_mostrador_easyresto.md.
//
// false (default): comanda con "Nro:" chico y comprobante interno sin numero, igual que antes de nroTicket.
// true           : numero corto grande en comanda y comprobante (pedidos que no son de Salon). Pensado para mostrador.
//
// Idempotente: no hace nada si la columna ya existe.

exports.up = async function (knex) {
  const tiene = await knex.schema.hasColumn('parametros_impresion', 'nroTicketGrande');
  if (!tiene) {
    await knex.schema.alterTable('parametros_impresion', (table) => {
      table.boolean('nroTicketGrande').notNullable().defaultTo(false);
    });
  }
};

exports.down = async function (knex) {
  const tiene = await knex.schema.hasColumn('parametros_impresion', 'nroTicketGrande');
  if (tiene) {
    await knex.schema.alterTable('parametros_impresion', (table) => {
      table.dropColumn('nroTicketGrande');
    });
  }
};
