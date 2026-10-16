
const express = require("express");
const oracledb = require('../config/driver');

const { login } = require("../controllers/authController");

const {
  verificarToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Inicio de sesión
router.post("/login", login);

// Consultar permisos del usuario autenticado
router.get("/permisos", verificarToken, async (req, res) => {
  let conexion;

  try {
    conexion = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });

    const resultado = await conexion.execute(
      `SELECT p.CODIGO
       FROM PERMISOS p
       INNER JOIN ROL_PERMISO rp
         ON p.ID_PERMISO = rp.ID_PERMISO
       WHERE rp.ID_ROL = :idRol
       ORDER BY p.CODIGO`,
      {
        idRol: req.usuario.ID_ROL
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    res.set("Cache-Control", "no-store");
    return res.json({
      usuario: { id: req.usuario.ID_USUARIO, idRol: req.usuario.ID_ROL, rol: req.usuario.ROL },
      permisos: resultado.rows.map(p => p.CODIGO)
    });

  } catch (error) {
    console.error("Error consultando permisos:", error.message);

    return res.status(500).json({
      mensaje: "Error al consultar permisos"
    });

  } finally {
    if (conexion) {
      await conexion.close();
    }
  }
});

module.exports = router;
