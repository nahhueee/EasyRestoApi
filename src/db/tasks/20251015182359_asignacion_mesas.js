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
