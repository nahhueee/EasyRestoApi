// Migration (DDL + datos, inseparables): destinos de comanda en `parametros_impresion`.
// Ver documentos/handoff_rework_productos_comandas.md, PR1 §1.3.
//
// destinoBarra   : a qué comanda va lo que se prepara en la barra     ('principal' | 'barra' | 'ninguna')
// destinoSinPrep : a qué comanda va lo que no se prepara (latas, etc.) ('principal' | 'barra' | 'ninguna')
// El sector 'cocina' va siempre a la comanda principal y no se configura.
//
// `comandaDoble` NO se toca: se mantiene derivado desde el backend para que un rollback de código siga andando.
//
// Datos: para que cada cliente imprima EXACTAMENTE igual que hoy, destinoBarra = 'barra' si tenía comanda
// doble, 'ninguna' si no. Hoy los terciarizados (ahora 'barra') salen en la 2ª comanda solo con comandaDoble = 1.
// destinoSinPrep queda en 'ninguna': hoy no existe ese sector.
//
// El UPDATE corre SOLO si `destinoBarra` se creó en esta corrida (idempotencia: no pisar lo que el usuario
// configure después). `comandaDoble` puede ser int o tinyint(1) según la base; `= 1` sirve para ambos y
// NULL cae en 'ninguna'.

exports.up = async function (knex) {
  const tieneBarra = await knex.schema.hasColumn('parametros_impresion', 'destinoBarra');
  const tieneSinPrep = await knex.schema.hasColumn('parametros_impresion', 'destinoSinPrep');

  if (!tieneBarra || !tieneSinPrep) {
    await knex.schema.alterTable('parametros_impresion', (table) => {
      if (!tieneBarra) table.string('destinoBarra', 10).notNullable().defaultTo('ninguna');
      if (!tieneSinPrep) table.string('destinoSinPrep', 10).notNullable().defaultTo('ninguna');
    });
  }

  if (!tieneBarra) {
    await knex.raw("UPDATE parametros_impresion SET destinoBarra = IF(comandaDoble = 1, 'barra', 'ninguna')");
  }
};

exports.down = async function (knex) {
  const tieneBarra = await knex.schema.hasColumn('parametros_impresion', 'destinoBarra');
  const tieneSinPrep = await knex.schema.hasColumn('parametros_impresion', 'destinoSinPrep');
  if (!tieneBarra && !tieneSinPrep) return;

  await knex.schema.alterTable('parametros_impresion', (table) => {
    if (tieneBarra) table.dropColumn('destinoBarra');
    if (tieneSinPrep) table.dropColumn('destinoSinPrep');
  });
};
