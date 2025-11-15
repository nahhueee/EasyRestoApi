export function up(knex) {
  return knex.schema
    .dropTableIfExists('parametros_impresion')
    .createTable('parametros_impresion', (table) => {
      table.string('impresora', 100);
      table.string('papel', 10);
      table.integer('margenIzq').defaultTo(0);
      table.integer('margenDer').defaultTo(0);
      table.string('nomLocal', 100);
      table.string('desLocal', 100);
      table.string('dirLocal', 150);
    })
    .then(() => {
      return knex('parametros_impresion').insert({
        impresora: '',
        papel: '58mm',
        margenIzq: 0,
        margenDer: 0,
        nomLocal: 'EASY RESTO',
        desLocal: '',
        dirLocal: ''
      });
    });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('parametros_impresion');
}
