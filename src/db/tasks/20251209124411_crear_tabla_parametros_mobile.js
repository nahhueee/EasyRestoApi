export async function up(knex) {
  // 1. Crear la tabla 'parametros_mobile'
  await knex.schema.createTable('parametros_mobile', (table) => {
    // Definimos las columnas como enteros con valor por defecto 0
    table.integer('imagenes').defaultTo(0);
    table.integer('todasMesas').defaultTo(0);
    table.integer('impComprobante').defaultTo(0);
  });

  // 2. Insertar el registro inicial (VALUES 0, 0, 0)
  await knex('parametros_mobile').insert({
    imagenes: 0,
    todasMesas: 0,
    impComprobante: 0
  });
}

export async function down(knex){
  // Eliminar la tabla si se revierte la migración
  await knex.schema.dropTableIfExists('parametros_mobile');
}