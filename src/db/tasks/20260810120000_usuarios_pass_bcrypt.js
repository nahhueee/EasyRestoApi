// Migration: ampliar usuarios.pass a VARCHAR(72) y rehashear passwords en texto plano
// a bcrypt (ver documentos/handoff_rediseno_login.md).
//
// Orden importa: el ALTER va antes del rehash. Un hash bcrypt son 60 caracteres; con la
// columna en VARCHAR(30) (script.sql), MySQL trunca en silencio y nadie vuelve a entrar
// al sistema sin ningún error visible.
//
// Idempotente: si una password ya empieza con "$2" (prefijo de hash bcrypt), se saltea.
// Necesario porque si se corriera dos veces hashearía el hash y nadie entraría más.

const bcrypt = require('bcryptjs');

exports.up = async function (knex) {
  await knex.raw('ALTER TABLE usuarios MODIFY pass VARCHAR(72)');

  const usuarios = await knex('usuarios').select('id', 'pass');

  for (const usuario of usuarios) {
    if (!usuario.pass || usuario.pass.startsWith('$2')) continue; // vacío o ya hasheado

    const hash = await bcrypt.hash(usuario.pass, 10);
    await knex('usuarios').where('id', usuario.id).update({ pass: hash });
  }
};

exports.down = async function (knex) {
  // No se puede "deshashear" — no hay vuelta atrás para las passwords ya migradas.
  // Solo se revierte el ancho de la columna, y únicamente tiene sentido si el up
  // corrió sobre una tabla sin usuarios. Revertir con datos migrados deja hashes
  // truncados a 30 caracteres: nadie puede ingresar y no hay forma de recuperarlos.
  await knex.raw('ALTER TABLE usuarios MODIFY pass VARCHAR(30)');
};
