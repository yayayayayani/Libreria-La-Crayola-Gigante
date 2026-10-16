
const jwt = require("jsonwebtoken");
const oracledb = require('../config/driver');

const verificarToken = async (req, res, next) => {
  let conexion;

  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        mensaje: "Token de acceso requerido"
      });
    }

    const token = authorization.split(" ")[1];

    const datos = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );

    if (!Number.isSafeInteger(datos.id) || datos.id <= 0 || !Number.isFinite(datos.exp)) {
      return res.status(401).json({ mensaje: "Token inválido" });
    }

    conexion = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });

    const resultado = await conexion.execute(
      `SELECT
          u.ID_USUARIO,
          u.NOMBRE_USUARIO,
          u.ID_ROL,
          u.ESTADO,
          r.NOMBRE AS ROL,
          r.ESTADO AS ROL_ESTADO
       FROM USUARIOS u
       INNER JOIN ROLES r
         ON u.ID_ROL = r.ID_ROL
       WHERE u.ID_USUARIO = :id`,
      { id: datos.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const usuario = resultado.rows[0];

    if (
      !usuario ||
      usuario.ESTADO !== "A" ||
      usuario.ROL_ESTADO !== "A"
    ) {
      return res.status(403).json({
        mensaje: "Usuario o rol inactivo"
      });
    }

    req.usuario = usuario;
    next();

  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        mensaje: "Sesión inválida o expirada"
      });
    }

    console.error("Error de autenticación:", error.message);

    return res.status(500).json({
      mensaje: "Error al verificar la sesión"
    });

  } finally {
    if (conexion) {
      await conexion.close();
    }
  }
};

const soloAdministrador = (req, res, next) => {
  if (req.usuario.ID_ROL !== 1) {
    return res.status(403).json({
      mensaje: "No tienes permisos para esta función"
    });
  }

  next();
};

module.exports = {
  verificarToken,
  soloAdministrador
};
