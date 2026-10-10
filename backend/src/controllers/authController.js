
const oracledb = require("oracledb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const login = async (req, res) => {
  let conexion;

  try {
    const { usuario, contrasena } = req.body || {};

    if (
      typeof usuario !== "string" ||
      typeof contrasena !== "string" ||
      !usuario.trim() ||
      !contrasena
    ) {
      return res.status(400).json({
        mensaje: "Ingrese usuario y contraseña"
      });
    }

    conexion = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });

    const resultado = await conexion.execute(
      `SELECT
          u.ID_USUARIO,
          u.NOMBRE_COMPLETO,
          u.NOMBRE_USUARIO,
          u.CONTRASENA_HASH,
          u.ESTADO,
          r.ID_ROL,
          r.NOMBRE AS ROL,
          r.ESTADO AS ROL_ESTADO
       FROM USUARIOS u
       INNER JOIN ROLES r
         ON u.ID_ROL = r.ID_ROL
       WHERE u.NOMBRE_USUARIO = :usuario`,
      {
        usuario: usuario.trim()
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    const cuenta = resultado.rows[0];

    if (!cuenta) {
      return res.status(401).json({
        mensaje: "Credenciales incorrectas"
      });
    }

    const valida = await bcrypt.compare(
      contrasena,
      cuenta.CONTRASENA_HASH
    );

    if (!valida) {
      return res.status(401).json({
        mensaje: "Credenciales incorrectas"
      });
    }

    if (
      cuenta.ESTADO !== "A" ||
      cuenta.ROL_ESTADO !== "A"
    ) {
      return res.status(403).json({
        mensaje: "Cuenta o rol inactivo"
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET no configurado");
    }

    const token = jwt.sign(
      {
        id: cuenta.ID_USUARIO
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      mensaje: "Inicio de sesión exitoso",
      token,
      usuario: {
        id: cuenta.ID_USUARIO,
        nombre: cuenta.NOMBRE_COMPLETO,
        usuario: cuenta.NOMBRE_USUARIO,
        rol: cuenta.ROL
      }
    });

  } catch (error) {
    console.error("Error en login:", error.message);

    return res.status(500).json({
      mensaje: "Error interno del servidor"
    });

  } finally {
    if (conexion) {
      await conexion.close();
    }
  }
};

module.exports = { login };
