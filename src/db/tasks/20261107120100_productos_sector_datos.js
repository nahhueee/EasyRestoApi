// Migration (datos): clasifica los productos existentes según su `tipo` histórico.
// Ver documentos/handoff_rework_productos_comandas.md, PR1 §1.2.
//
// terciarizado -> sector 'barra' + controlaStock = 1 (hoy ya descontaban stock y salían en la 2ª comanda).
// Los elaborados (y los `tipo` NULL o con otro valor) quedan bien por el default de la migration anterior:
// sector 'cocina', controlaStock = 0.
//
// Guarda: si la columna `sector` no existe (la migration DDL no corrió), no hace nada.

exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('productos', 'sector'))) return;
  if (!(await knex.schema.hasColumn('productos', 'controlaStock'))) return;

  await knex.raw("UPDATE productos SET sector = 'barra', controlaStock = 1 WHERE tipo = 'terciarizado'");
};

exports.down = async function () {
  // No-op a propósito: los defaults de la migration DDL hacen que su `down` (dropColumn) alcance.
  // Revertir los datos acá no aporta nada y no se puede distinguir lo migrado de lo cargado después.
};
