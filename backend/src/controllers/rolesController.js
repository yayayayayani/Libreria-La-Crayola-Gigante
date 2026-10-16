
const oracledb = require('../config/driver');

const conectar = () => oracledb.getConnection({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
});

// Obtener roles
const listarRoles = async (req, res) => {
  let conexion;

  try {
    conexion = await conectar();

    const resultado = await conexion.execute(
      `SELECT ID_ROL, NOMBRE, DESCRIPCION, ESTADO
       FROM ROLES
       ORDER BY ID_ROL`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      mensaje: "Error al consultar roles"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// Obtener catálogo de permisos
const listarPermisos = async (req, res) => {
  let conexion;

  try {
    conexion = await conectar();

    const resultado = await conexion.execute(
      `SELECT ID_PERMISO, CODIGO, DESCRIPCION
       FROM PERMISOS
       ORDER BY CODIGO`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      mensaje: "Error al consultar permisos"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// Consultar permisos de un rol
const permisosPorRol = async (req, res) => {
  let conexion;

  try {
    const idRol = Number(req.params.id);

    if (!Number.isInteger(idRol) || idRol <= 0) {
      return res.status(400).json({
        mensaje: "ID de rol inválido"
      });
    }

    conexion = await conectar();

    const resultado = await conexion.execute(
      `SELECT p.ID_PERMISO, p.CODIGO, p.DESCRIPCION
       FROM PERMISOS p
       INNER JOIN ROL_PERMISO rp
         ON p.ID_PERMISO = rp.ID_PERMISO
       WHERE rp.ID_ROL = :idRol
       ORDER BY p.CODIGO`,
      { idRol },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json(resultado.rows);

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      mensaje: "Error al consultar permisos del rol"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// Actualizar permisos de un rol
const actualizarPermisos = async (req, res) => {
  let conexion;

  try {
    const idRol = Number(req.params.id);
    const { permisos } = req.body || {};

    if (
      !Number.isInteger(idRol) ||
      idRol <= 0 ||
      !Array.isArray(permisos) ||
      !permisos.every(
        id => Number.isInteger(id) && id > 0
      ) ||
      new Set(permisos).size !== permisos.length
    ) {
      return res.status(400).json({
        mensaje: "Lista de permisos inválida"
      });
    }

    // Protegemos los permisos del administrador
    // para evitar bloquear la administración.
    if (idRol === 1) {
      return res.status(403).json({
        mensaje: "Los permisos del administrador están protegidos"
      });
    }

    conexion = await conectar();

    const rol = await conexion.execute(
      `SELECT ID_ROL FROM ROLES
       WHERE ID_ROL = :idRol AND ESTADO = 'A' FOR UPDATE`,
      { idRol }
    );

    if (rol.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Rol no encontrado o inactivo"
      });
    }

    if (permisos.length > 0) {
      const validacion = await conexion.execute(
        `SELECT ID_PERMISO FROM PERMISOS`
      );

      const validos = new Set(
        validacion.rows.map(fila => fila[0])
      );

      if (!permisos.every(id => validos.has(id))) {
        return res.status(400).json({
          mensaje: "Uno o más permisos no existen"
        });
      }
    }

    await conexion.execute(
      `DELETE FROM ROL_PERMISO
       WHERE ID_ROL = :idRol`,
      { idRol }
    );

    for (const idPermiso of permisos) {
      await conexion.execute(
        `INSERT INTO ROL_PERMISO
         (ID_ROL, ID_PERMISO)
         VALUES (:idRol, :idPermiso)`,
        { idRol, idPermiso }
      );
    }

    await conexion.commit();

    return res.json({
      mensaje: "Permisos actualizados correctamente"
    });

  } catch (error) {
    if (conexion) await conexion.rollback();

    console.error(error.message);

    return res.status(500).json({
      mensaje: "Error al actualizar permisos"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

module.exports = {
  listarRoles,
  listarPermisos,
  permisosPorRol,
  actualizarPermisos
};
