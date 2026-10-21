const oracledb = require("../config/driver");
const { permisoVisible } = require("../services/acceso");

const verificarPermiso = (codigoPermiso) => {
  return async (req, res, next) => {
    let conexion;

    try {
      if (!req.usuario) {
        return res.status(401).json({
          mensaje: "Usuario no autenticado",
        });
      }

      conexion = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const codigos = (Array.isArray(codigoPermiso) ? codigoPermiso : [codigoPermiso])
        .filter((codigo) => permisoVisible(req.usuario.ID_ROL, codigo));
      if (!codigos.length) return res.status(403).json({ mensaje: "Esta función es exclusiva de administración" });
      const binds = Object.fromEntries(codigos.map((codigo, i) => [`codigo${i}`, codigo]));
      const resultado = await conexion.execute(
        `SELECT COUNT(*) AS TOTAL
         FROM ROL_PERMISO rp
         INNER JOIN PERMISOS p
           ON rp.ID_PERMISO = p.ID_PERMISO
         WHERE rp.ID_ROL = :idRol
           AND p.CODIGO IN (${codigos.map((_, i) => `:codigo${i}`).join(",")})`,
        {
          idRol: req.usuario.ID_ROL,
          ...binds,
        },
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        },
      );

      const autorizado = resultado.rows[0].TOTAL > 0;

      if (!autorizado) {
        return res.status(403).json({
          mensaje: "No tienes permisos para realizar esta acción",
        });
      }

      return next();
    } catch (error) {
      console.error("Error verificando permiso:", error.message);

      return res.status(500).json({
        mensaje: "Error al comprobar permisos",
      });
    } finally {
      if (conexion) {
        await conexion.close();
      }
    }
  };
};

module.exports = { verificarPermiso };
