// RESTAURADA del histórico (Actualizacion/backend). Esta migration ya corrió en bases de clientes y knex
// exige que su archivo exista (si falta: "migration directory is corrupt"). Solo se le agregaron guardas
// de idempotencia (y sintaxis CJS) para que sea no-op sobre el schema final de la migration base.
// Su efecto donde ya corrió no cambia.
module.exports = {
  up: async function(knex) {
    const hasColumnAsignacion = await knex.schema.hasColumn('mesas', 'asignacion');
    if (!hasColumnAsignacion) {
      await knex.schema.alterTable('mesas', (table) => {
        table.integer('asignacion').defaultTo(0);
      });
    }

    const hasColumnMostrarDesc = await knex.schema.hasColumn('productos_precio', 'mostrarDesc');
    if (hasColumnMostrarDesc) {
      await knex.schema.alterTable('productos_precio', (table) => {
        table.dropColumn('mostrarDesc');
      });
    }
  },

  down: async function(knex) {
    const hasColumnAsignacion = await knex.schema.hasColumn('mesas', 'asignacion');
    if (hasColumnAsignacion) {
      await knex.schema.alterTable('mesas', (table) => {
        table.dropColumn('asignacion');
      });
    }

    const hasColumnMostrarDesc = await knex.schema.hasColumn('productos_precio', 'mostrarDesc');
    if (!hasColumnMostrarDesc) {
      await knex.schema.alterTable('productos_precio', (table) => {
        table.boolean('mostrarDesc');
      });
    }
  }
};
