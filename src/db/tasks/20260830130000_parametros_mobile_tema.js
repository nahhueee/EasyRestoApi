// Migration: agrega parametros_mobile.tema y parametros_mobile.modoOscuro.
//
// Fase 1 del trabajo de theming de EasyRestoMobile (rediseño UX, agosto 2026):
// la app mobile va a poder elegir color de marca (mismos 6 temas que ya
// existen en EasyRestoApp: red/pink/blue/green/yellow/orange) y modo
// claro/oscuro, controlados a mano por el usuario (no por el sistema
// operativo del teléfono - eso era la causa real de mensajes que a veces no
// se veían en modo claro).
//
// OJO: en EasyRestoApp hoy 'tema' vive en localStorage de cada terminal
// ('green-theme', CON el sufijo '-theme') y nunca se escribió en la base.
// Acá se guarda el slug PELADO ('green', sin '-theme') porque es el mismo
// valor que ya usa GetPrimario() en el desktop después de hacer
// `.replace('-theme','')` - más simple para el consumidor mobile, y para
// cuando se sincronice desktop→DB (fase aparte, todavía no implementada)
// alcanza con mandar el mismo replace de siempre.
//
// parametros_mobile es de una sola fila sin PK (igual que
// parametros_facturacion/parametros_impresion) - el DEFAULT alcanza para
// completar la fila existente, no hace falta backfill manual.
exports.up = async function (knex) {
  await knex.raw(
    "ALTER TABLE parametros_mobile ADD COLUMN tema VARCHAR(20) NOT NULL DEFAULT 'green' AFTER impComprobante"
  );
  await knex.raw(
    'ALTER TABLE parametros_mobile ADD COLUMN modoOscuro INT NOT NULL DEFAULT 0 AFTER tema'
  );
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE parametros_mobile DROP COLUMN modoOscuro');
  await knex.raw('ALTER TABLE parametros_mobile DROP COLUMN tema');
};
