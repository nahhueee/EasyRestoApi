// Migration: crea `productos_movimientos`, el libro de stock auditable (architecture.md §12.4).
// Ver documentos/handoff_rework_productos_comandas.md, PR1 §1.4.
//
// Sin foreign keys a propósito (igual que `eventos`): el historial tiene que sobrevivir al borrado físico
// del producto. Columnas en camelCase por consistencia con `eventos` (§12.4 usa snake_case, pero el código
// real ya se desvió). `productos.cantidad` es INT, así que los deltas también.
//
// motivo: INICIAL | INGRESO | EGRESO | CONTEO | MIGRACION (después: PEDIDO, ANULACION_PEDIDO).
//
// Saldo inicial: solo si la tabla se creó en esta corrida, deja una fila MIGRACION por cada producto que
// controla stock, para que el historial cierre contra `productos.cantidad`. Depende de la migration de datos
// de sector (controlaStock ya clasificado): por eso su timestamp es posterior.
//
// Idempotente: si la tabla ya existe, no hace nada.

exports.up = async function (knex) {
  if (await knex.schema.hasTable('productos_movimientos')) return;

  await knex.schema.createTable('productos_movimientos', (table) => {
    table.increments('id'); // INT UNSIGNED AUTO_INCREMENT PK
    table.dateTime('fecha').notNullable().defaultTo(knex.fn.now());
    table.integer('idProducto').notNullable();
    table.string('motivo', 20).notNullable();
    table.integer('cantidadDelta').notNullable();
    table.integer('cantidadResultante').notNullable();
    table.integer('referenciaId').nullable();
    table.string('observacion', 255).nullable();
    table.string('puesto', 60).nullable();
    table.integer('idUsuario').nullable();

    table.index(['idProducto', 'fecha'], 'idx_productos_movimientos_producto');
  });

  if (await knex.schema.hasColumn('productos', 'controlaStock')) {
    await knex.raw(
      "INSERT INTO productos_movimientos (idProducto, motivo, cantidadDelta, cantidadResultante, observacion) " +
      "SELECT id, 'MIGRACION', IFNULL(cantidad, 0), IFNULL(cantidad, 0), 'Saldo al activar historial de stock' " +
      "FROM productos WHERE controlaStock = 1"
    );
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('productos_movimientos');
};
