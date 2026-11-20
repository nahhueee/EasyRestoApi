// Migration: el tipo de pedido 1 pasa de llamarse RESTAURANTE a SALÓN (como se muestra en la app:
// lista, tablero, mesas y nueva carga de pedido). Solo cambia el nombre: el id y el icono quedan igual,
// y nada del sistema compara por nombre (todo va por id).
// Se renombra solo si todavia tiene el nombre original, para no pisar un nombre que alguien haya editado a mano.

exports.up = async function (knex) {
  await knex('pedidos_tipo').where({ id: 1, nombre: 'RESTAURANTE' }).update({ nombre: 'SALÓN' });
};

exports.down = async function (knex) {
  await knex('pedidos_tipo').where({ id: 1, nombre: 'SALÓN' }).update({ nombre: 'RESTAURANTE' });
};
