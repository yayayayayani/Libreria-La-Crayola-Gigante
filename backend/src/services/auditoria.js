// La auditoría forma parte de la misma transacción que el cambio.
async function auditar(c, req, accion, tabla, id, detalle) {
  await c.execute(`INSERT INTO bitacora(id_usuario,accion,tabla_afectada,id_registro_afectado,detalle)
    VALUES (:usuario,:accion,:tabla,:id,:detalle)`, {
    usuario: req.usuario.ID_USUARIO, accion, tabla, id: id ?? null,
    detalle: String(detalle || '').slice(0, 1000),
  });
}
module.exports = { auditar };
