// Migration: crea la tabla `eventos`, auditoría genérica de EasyResto (primera
// implementación real del modelo de architecture.md §12.3 — EasySales todavía
// no la tiene). Ver documentos/handoff_precios_ajuste_masivo_easyresto.md, PR2.
//
// Sin foreign keys a propósito: la auditoría tiene que sobrevivir al borrado
// del producto, del usuario o del precio que referencia. Un registro huérfano
// es preferible a uno inexistente.
//
// `puesto` (VARCHAR) en vez de `puestoId` (UUID): EasyResto identifica el
// puesto por el hostname de la máquina (Tauri `get_hostname`), no por el UUID
// v4 + tabla `puestos` que describe architecture.md §9.2/§12.3.1 -esa tabla
// todavía no existe en este producto-. El nombre de columna es deliberado
// para no repetir la confusión semántica ya documentada (un hostname guardado
// en una columna "puestoId" sería el mismo error de nuevo).
//
// Idempotente: chequea existencia de la tabla antes de crearla.

exports.up = async function (knex) {
  const existe = await knex.schema.hasTable('eventos');
  if (existe) return;

  await knex.schema.createTable('eventos', (table) => {
    table.increments('id');
    table.dateTime('fecha').notNullable().defaultTo(knex.fn.now());
    table.string('loteId', 36).nullable();
    table.string('puesto', 60).nullable();
    table.integer('idUsuario').nullable();
    table.string('accion', 40).notNullable();
    table.string('entidad', 40).notNullable();
    table.integer('entidadId').nullable();
    table.json('datosBefore').nullable();
    table.json('datosAfter').nullable();
    table.string('observacion', 255).nullable();

    table.index('loteId', 'idx_eventos_lote');
    table.index(['entidad', 'entidadId', 'fecha'], 'idx_eventos_entidad');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('eventos');
};
