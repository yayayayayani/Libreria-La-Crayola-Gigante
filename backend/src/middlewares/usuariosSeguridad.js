const oracledb = require('../config/driver');

// El permiso de gestionar usuarios no autoriza a delegar privilegios superiores.
async function protegerUsuarios(req, res, next) {
  const actor = req.usuario;
  const id = Number(req.params.id);
  const datos = req.body || {};
  if (req.method !== "POST" && (!Number.isSafeInteger(id) || id <= 0)) {
    return res.status(400).json({ mensaje: "ID de usuario inválido" });
  }
  if ((id === actor.ID_USUARIO &&
      (req.method === "PATCH" || datos.idRol !== actor.ID_ROL)) ||
      Object.keys(datos).some(campo => !(
        req.method === "POST"
          ? ["nombreCompleto", "nombreUsuario", "contrasena", "idRol", "correo"]
          : req.method === "PUT" ? ["nombreCompleto", "idRol", "correo"] : ["estado"]
      ).includes(campo))) {
    return res.status(403).json({ mensaje: "No puedes modificar tus privilegios ni campos protegidos" });
  }
  if (actor.ID_ROL === 1) return next();
  if (req.method !== "PATCH" && datos.idRol !== actor.ID_ROL) {
    return res.status(403).json({ mensaje: "Solo el administrador puede asignar un rol diferente al tuyo" });
  }
  let conexion;
  try {
    if (req.method !== "POST") {
      conexion = await oracledb.getConnection({
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING
      });
      const resultado = await conexion.execute(
        "SELECT ID_ROL FROM USUARIOS WHERE ID_USUARIO = :id",
        { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!resultado.rows.length) return res.status(404).json({ mensaje: "Usuario no encontrado" });
      if (resultado.rows[0].ID_ROL !== actor.ID_ROL) {
        return res.status(403).json({ mensaje: "Solo el administrador puede modificar usuarios de otro rol" });
      }
    }
    return next();
  } catch (error) {
    return res.status(500).json({ mensaje: "No se pudo verificar la autorización administrativa" });
  } finally {
    if (conexion) await conexion.close();
  }
}

module.exports = { protegerUsuarios };
