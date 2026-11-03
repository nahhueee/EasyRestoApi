// Migration: reconcilia el schema de las bases de clientes con el schema objetivo (el de la
// migration base 20250101000000_schema_base). Ver documentos/handoff_instalador_migracion_base.md.
//
// Por qué existe: script.sql nunca fue la única fuente de verdad. Hubo clientes instalados con
// versiones viejas a los que se les corrigió el schema a mano (o no se les corrigió), y hoy hay
// columnas que el código usa y que algunas bases no tienen.
//
// Reglas:
//  - ADITIVA y expand-only: agrega columnas y ENSANCHA columnas. Nunca borra ni achica nada.
//  - IDEMPOTENTE: cada paso mira el estado REAL de la base (information_schema) y solo actúa si
//    falta. Es no-op sobre una instalación nueva (la migration base ya trae el schema final) y
//    sobre una base que ya fue corregida a mano.
//  - Al ensanchar se conserva la nulabilidad y el DEFAULT que la columna tenga hoy.
//  - Lo que NO toca (decisión consciente): columnas más anchas que el objetivo, orden de columnas,
//    columnas que sobran (p. ej. pedidos_detalle.tipoProdVar) y tablas legacy (rubros, variantes,
//    producto_variedad, variedad_guarnicion, variedad_variante).

const ENTEROS = ['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'];

async function infoColumna(knex, tabla, columna) {
  const [filas] = await knex.raw(
    'SELECT DATA_TYPE AS tipo, CHARACTER_MAXIMUM_LENGTH AS largo, IS_NULLABLE AS nulable, COLUMN_DEFAULT AS def ' +
    'FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tabla, columna]
  );
  return filas.length ? filas[0] : null;
}

// Fragmento "NOT NULL DEFAULT 'x'" / "DEFAULT NULL" que conserva lo que la columna tiene hoy.
function nulabilidadYDefault(info) {
  const nulo = info.nulable === 'YES' ? '' : ' NOT NULL';
  if (info.def === null || info.def === undefined) return info.nulable === 'YES' ? ' DEFAULT NULL' : nulo;
  const literal = "'" + String(info.def).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
  return nulo + ' DEFAULT ' + literal;
}

// VARCHAR más corto que `largo` -> se ensancha a `largo`. Si ya es >= largo, no hace nada.
async function ensancharVarchar(knex, tabla, columna, largo) {
  if (!(await knex.schema.hasTable(tabla))) return;
  const info = await infoColumna(knex, tabla, columna);
  if (!info) return;
  if (info.tipo !== 'varchar' || Number(info.largo) >= largo) return;
  await knex.raw(
    'ALTER TABLE `' + tabla + '` MODIFY COLUMN `' + columna + '` VARCHAR(' + largo + ')' + nulabilidadYDefault(info)
  );
}

exports.up = async function (knex) {
  // 1. pedidos_pago.obs: el código la inserta y la lee (pedidosRepository).
  if ((await knex.schema.hasTable('pedidos_pago')) && !(await knex.schema.hasColumn('pedidos_pago', 'obs'))) {
    await knex.raw('ALTER TABLE `pedidos_pago` ADD COLUMN `obs` VARCHAR(150) NULL');
  }

  // 2. pedidos_factura.condReceptor (condición IVA del receptor, comprobantes).
  if (
    (await knex.schema.hasTable('pedidos_factura')) &&
    !(await knex.schema.hasColumn('pedidos_factura', 'condReceptor'))
  ) {
    await knex.raw('ALTER TABLE `pedidos_factura` ADD COLUMN `condReceptor` INT NULL DEFAULT 0');
  }

  // 3. Anchos: el front permite 25 caracteres de descripción de precio; categorías 30 / ícono 5.
  await ensancharVarchar(knex, 'productos_precio', 'descripcion', 25);
  await ensancharVarchar(knex, 'categorias', 'nombre', 30);
  await ensancharVarchar(knex, 'categorias', 'icono', 5);

  // 4. pedidos_pago.monto: guarda el total del pago (con centavos). Si quedó entero, se pasa a
  //    DECIMAL(10,2); los valores existentes se conservan.
  if (await knex.schema.hasTable('pedidos_pago')) {
    const monto = await infoColumna(knex, 'pedidos_pago', 'monto');
    if (monto && ENTEROS.includes(monto.tipo)) {
      await knex.raw("ALTER TABLE `pedidos_pago` MODIFY COLUMN `monto` DECIMAL(10,2) NULL DEFAULT '0.00'");
    }
  }
};

exports.down = async function () {
  // No-op a propósito: la migration es aditiva y ensancha columnas. Revertirla (borrar `obs` /
  // `condReceptor`, achicar anchos) perdería datos y rompería el código actual.
};
