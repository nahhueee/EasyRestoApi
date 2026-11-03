// Migration: agrega eventos.loteIdOrigen (ver documentos/handoff_precios_ajuste_masivo_easyresto.md, PR6).
//
// Hasta PR5, "¿este lote ya fue revertido?" se resolvía buscando texto en
// `observacion` de los eventos PRECIO_REVERTIR (`LIKE '%loteId%'`). Alcanzaba
// para chequear un lote puntual (deshacer-lote), pero PR6 necesita, para una
// página entera de lotes, contar cuántos de los eventos de CADA lote ya
// tienen su reversión -eso exige agrupar/contar, y no se puede agrupar
// eficientemente sobre un LIKE por fila sin volver a N+1.
//
// `loteIdOrigen` es nullable y solo se completa en los eventos que audita una
// reversión (accion = 'PRECIO_REVERTIR'): apunta al loteId que se revirtió.
// No reemplaza la lectura por `observacion` en el mensaje al usuario ni toca
// filas existentes -es aditiva-. Con esto `existeReversionDeLote` pasa de
// `LIKE` a `= ?`, y se puede hacer `GROUP BY loteIdOrigen` para el conteo
// batched que usa ObtenerLotes.

exports.up = async function (knex) {
  // Guardas de idempotencia (architecture.md §13): sobre una instalación nueva la migration base ya
  // crea la columna y el índice, y un ADD sin guarda tiraría 'duplicate column'. No cambia el efecto
  // donde esta migration ya corrió.
  if (!(await knex.schema.hasColumn('eventos', 'loteIdOrigen'))) {
    await knex.raw('ALTER TABLE eventos ADD COLUMN loteIdOrigen CHAR(36) NULL AFTER loteId');
  }
  const [indices] = await knex.raw("SHOW INDEX FROM eventos WHERE Key_name = 'idx_eventos_lote_origen'");
  if (indices.length === 0) {
    await knex.raw('ALTER TABLE eventos ADD INDEX idx_eventos_lote_origen (loteIdOrigen)');
  }

  // Backfill: las reversiones escritas antes de esta migración (todo el
  // testing de PR5) quedan con loteIdOrigen NULL -la columna no existía
  // cuando se insertaron-. Sin este paso, existeReversionDeLote (que a partir
  // de acá compara por loteIdOrigen, no por LIKE) las trata como "no
  // revertidas": ObtenerLotes las muestra VIGENTE cuando en realidad ya se
  // deshicieron, y deshacer-lote las dejaría revertir de nuevo.
  //
  // El UUID se extrae con RIGHT(observacion, 36) -son siempre los últimos 36
  // caracteres del texto (`Reversión del lote ${loteId}`), formato fijo de
  // UUID v4-. A propósito NO se usa SUBSTRING(observacion, LENGTH(prefijo)+1):
  // LENGTH() cuenta bytes, no caracteres, y el prefijo tiene una "ó"
  // (2 bytes en UTF-8) -eso corría el corte un byte de más y se comía el
  // primer dígito del UUID. RIGHT() no depende de la longitud del prefijo,
  // así que no tiene ese problema. Idempotente (WHERE loteIdOrigen IS NULL):
  // no toca lo que ya se backfilleó una vez.
  await knex.raw(
    "UPDATE eventos SET loteIdOrigen = RIGHT(observacion, 36) " +
    "WHERE accion = 'PRECIO_REVERTIR' AND loteIdOrigen IS NULL AND observacion LIKE 'Reversión del lote %'"
  );
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE eventos DROP INDEX idx_eventos_lote_origen');
  await knex.raw('ALTER TABLE eventos DROP COLUMN loteIdOrigen');
};
