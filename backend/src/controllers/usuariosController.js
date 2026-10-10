
const oracledb = require("oracledb");
const bcrypt = require("bcryptjs");

const conectar = () => oracledb.getConnection({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
});

const rolesAsignables = async (req, res) => {
  let conexion;
  try {
    conexion = await conectar();
    const resultado = await conexion.execute(
      `SELECT ID_ROL, NOMBRE FROM ROLES WHERE ESTADO = 'A'
       AND (:idRol = 1 OR ID_ROL = :idRol) ORDER BY NOMBRE`,
      { idRol: req.usuario.ID_ROL }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return res.json(resultado.rows);
  } catch (error) {
    return res.status(500).json({ mensaje: "Error al consultar roles asignables" });
  } finally {
    if (conexion) await conexion.close();
  }
};

// CONSULTAR USUARIOS
const listarUsuarios = async (req, res) => {
  let conexion;

  try {
    conexion = await conectar();

    const resultado = await conexion.execute(
      `SELECT
          u.ID_USUARIO,
          u.NOMBRE_COMPLETO,
          u.NOMBRE_USUARIO,
          u.ID_ROL,
          r.NOMBRE AS ROL,
          u.ESTADO,
          u.CREADO_EN
       FROM USUARIOS u
       INNER JOIN ROLES r
         ON u.ID_ROL = r.ID_ROL
       ORDER BY u.ID_USUARIO`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json(resultado.rows);

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      mensaje: "Error al consultar usuarios"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// CREAR USUARIO
const crearUsuario = async (req, res) => {
  let conexion;

  try {
    const {
      nombreCompleto,
      nombreUsuario,
      contrasena,
      idRol
    } = req.body || {};

    if (
      typeof nombreCompleto !== "string" ||
      typeof nombreUsuario !== "string" ||
      typeof contrasena !== "string" ||
      !nombreCompleto.trim() ||
      !nombreUsuario.trim() ||
      contrasena.length < 8 ||
      !Number.isInteger(idRol)
    ) {
      return res.status(400).json({
        mensaje: "Verifica los datos. La contraseña requiere al menos 8 caracteres."
      });
    }

    conexion = await conectar();

    const rol = await conexion.execute(
      `SELECT ID_ROL FROM ROLES
       WHERE ID_ROL = :idRol AND ESTADO = 'A'`,
      { idRol }
    );

    if (rol.rows.length === 0) {
      return res.status(400).json({
        mensaje: "El rol no existe o está inactivo"
      });
    }

    const existe = await conexion.execute(
      `SELECT ID_USUARIO FROM USUARIOS
       WHERE NOMBRE_USUARIO = :usuario`,
      { usuario: nombreUsuario.trim() }
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({
        mensaje: "El nombre de usuario ya existe"
      });
    }

    const hash = await bcrypt.hash(contrasena, 12);

    await conexion.execute(
      `INSERT INTO USUARIOS (
         NOMBRE_COMPLETO,
         NOMBRE_USUARIO,
         CONTRASENA_HASH,
         ID_ROL,
         ESTADO,
         CREADO_EN
       ) VALUES (
         :nombre,
         :usuario,
         :hash,
         :idRol,
         'A',
         SYSTIMESTAMP
       )`,
      {
        nombre: nombreCompleto.trim(),
        usuario: nombreUsuario.trim(),
        hash,
        idRol
      },
      { autoCommit: true }
    );

    return res.status(201).json({
      mensaje: "Usuario creado correctamente"
    });

  } catch (error) {
    console.error(error.message);

    if (error.errorNum === 1) {
      return res.status(409).json({
        mensaje: "Ya existe un registro con esos datos"
      });
    }

    return res.status(500).json({
      mensaje: "Error al crear usuario"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// MODIFICAR USUARIO
const modificarUsuario = async (req, res) => {
  let conexion;

  try {
    const id = Number(req.params.id);
    const { nombreCompleto, idRol } = req.body || {};

    if (
      !Number.isInteger(id) || id <= 0 ||
      typeof nombreCompleto !== "string" ||
      !nombreCompleto.trim() ||
      !Number.isInteger(idRol)
    ) {
      return res.status(400).json({
        mensaje: "Datos inválidos"
      });
    }

    conexion = await conectar();

    const rol = await conexion.execute(
      `SELECT ID_ROL FROM ROLES
       WHERE ID_ROL = :idRol AND ESTADO = 'A'`,
      { idRol }
    );

    if (rol.rows.length === 0) {
      return res.status(400).json({
        mensaje: "Rol no válido"
      });
    }

    // Evitar que el administrador cambie su propio rol.
    if (id === req.usuario.ID_USUARIO &&
        idRol !== req.usuario.ID_ROL) {
      return res.status(400).json({
        mensaje: "No puedes cambiar tu propio rol"
      });
    }

    const resultado = await conexion.execute(
      `UPDATE USUARIOS
       SET NOMBRE_COMPLETO = :nombre,
           ID_ROL = :idRol
       WHERE ID_USUARIO = :id AND (:actorRol = 1 OR ID_ROL = :actorRol)`,
      {
        nombre: nombreCompleto.trim(),
        idRol,
        actorRol: req.usuario.ID_ROL,
        id
      },
      { autoCommit: true }
    );

    if (resultado.rowsAffected === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado"
      });
    }

    return res.json({
      mensaje: "Usuario actualizado correctamente"
    });

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      mensaje: "Error al modificar usuario"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// ACTIVAR O DESACTIVAR
const cambiarEstado = async (req, res) => {
  let conexion;

  try {
    const id = Number(req.params.id);
    const { estado } = req.body || {};

    if (
      !Number.isInteger(id) || id <= 0 ||
      !["A", "I"].includes(estado)
    ) {
      return res.status(400).json({
        mensaje: "Estado inválido"
      });
    }

    if (id === req.usuario.ID_USUARIO && estado === "I") {
      return res.status(400).json({
        mensaje: "No puedes desactivar tu propia cuenta"
      });
    }

    conexion = await conectar();

    const resultado = await conexion.execute(
      `UPDATE USUARIOS
       SET ESTADO = :estado
       WHERE ID_USUARIO = :id AND (:actorRol = 1 OR ID_ROL = :actorRol)`,
      { estado, id, actorRol: req.usuario.ID_ROL },
      { autoCommit: true }
    );

    if (resultado.rowsAffected === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado"
      });
    }

    return res.json({
      mensaje: "Estado actualizado correctamente"
    });

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      mensaje: "Error al cambiar estado"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

module.exports = {
  rolesAsignables,
  listarUsuarios,
  crearUsuario,
  modificarUsuario,
  cambiarEstado
};
