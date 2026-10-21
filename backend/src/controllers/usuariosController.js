const oracledb = require("../config/driver");
const bcrypt = require("bcryptjs");
const { nombreValido, correoValido, exigir } = require("../services/validaciones");
const { encolar, avisarDuplicado } = require("../services/correos");

function laboral(b) {
  const sueldo = b.sueldo == null || b.sueldo === "" ? null : b.sueldo;
  exigir(sueldo === null || (typeof sueldo === "number" && Number.isFinite(sueldo) && sueldo >= 0 && sueldo <= 9999999999.99 && Math.abs(sueldo * 100 - Math.round(sueldo * 100)) < 1e-6), "Sueldo invalido");
  exigir(b.horario == null || (typeof b.horario === "string" && b.horario.length <= 250), "Horario invalido");
  exigir(b.puesto == null || (typeof b.puesto === "string" && b.puesto.length <= 100), "Puesto invalido");
  return { sueldo, horario: b.horario?.trim() || null, puesto: b.puesto?.trim() || null };
}
const conectar = () =>
  oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
  });

const rolesAsignables = async (req, res) => {
  let conexion;
  try {
    conexion = await conectar();
    const resultado = await conexion.execute(
      `SELECT ID_ROL, NOMBRE FROM ROLES WHERE ESTADO = 'A'
       AND (:idRol IN (1,3) OR ID_ROL = :idRol) ORDER BY NOMBRE`,
      { idRol: req.usuario.ID_ROL },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
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
          u.CORREO,u.SUELDO,u.HORARIO,u.PUESTO,
          u.ID_ROL,
          r.NOMBRE AS ROL,
          u.ESTADO,
          u.CREADO_EN
       FROM USUARIOS u
       INNER JOIN ROLES r
         ON u.ID_ROL = r.ID_ROL
       ORDER BY u.ID_USUARIO`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    return res.json(resultado.rows);
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      mensaje: "Error al consultar usuarios",
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// CREAR USUARIO
const crearUsuario = async (req, res) => {
  let conexion;

  try {
    const trabajo = laboral(req.body || {});
    const { nombreCompleto, nombreUsuario, contrasena, idRol } = req.body || {};
    const correo = typeof req.body?.correo === "string" ? req.body.correo.trim().toLowerCase() : "";
    if (
      !nombreValido(nombreCompleto) ||
      nombreCompleto.trim().length > 120 ||
      !correoValido(correo) ||
      nombreUsuario?.length > 50
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            "Nombre sin números y correo válido obligatorios; revisa la longitud de los campos",
        });
    }

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
        mensaje: "Verifica los datos. La contraseña requiere al menos 8 caracteres.",
      });
    }

    conexion = await conectar();

    const rol = await conexion.execute(
      `SELECT ID_ROL FROM ROLES
       WHERE ID_ROL = :idRol AND ESTADO = 'A'`,
      { idRol },
    );

    if (rol.rows.length === 0) {
      return res.status(400).json({
        mensaje: "El rol no existe o está inactivo",
      });
    }

    const existe = await conexion.execute(
      `SELECT ID_USUARIO FROM USUARIOS
       WHERE NOMBRE_USUARIO = :usuario`,
      { usuario: nombreUsuario.trim() },
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({
        mensaje: "El nombre de usuario ya existe",
      });
    }

    const hash = await bcrypt.hash(contrasena, 12);

    await conexion.execute(
      `INSERT INTO USUARIOS (
         NOMBRE_COMPLETO,
         NOMBRE_USUARIO,
         CORREO,
         CONTRASENA_HASH,
         ID_ROL,
         ESTADO,
         CREADO_EN,SUELDO,HORARIO,PUESTO
       ) VALUES (
         :nombre,
         :usuario,
         :correo,
         :hash,
         :idRol,
         'A',
         SYSTIMESTAMP,:sueldo,:horario,:puesto
       )`,
      {
        nombre: nombreCompleto.trim(),
        usuario: nombreUsuario.trim(),
        correo,
        hash,
        ...trabajo,
        idRol,
      },
      { autoCommit: false },
    );
    await encolar(
      conexion,
      correo,
      "Cuenta registrada",
      "Tu cuenta de Librería La Crayola Gigante fue registrada. Solicita tus datos de acceso al administrador. No compartas tu contraseña.",
    );
    await conexion.commit();

    return res.status(201).json({
      mensaje: "Usuario creado correctamente",
    });
  } catch (error) {
    if (conexion) await conexion.rollback();
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    console.error(error.message);

    if (error.errorNum === 1) {
      const correo =
        typeof req.body?.correo === "string" ? req.body.correo.trim().toLowerCase() : "";
      if (conexion && correo) await avisarDuplicado(conexion, correo);
      return res.status(409).json({
        mensaje: "El correo o usuario ya está registrado. No se puede asignar a otra cuenta.",
      });
    }

    return res.status(500).json({
      mensaje: "Error al crear usuario",
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
    const trabajo = laboral(req.body || {});
    const { nombreCompleto, idRol } = req.body || {};
    const correo = typeof req.body?.correo === "string" ? req.body.correo.trim().toLowerCase() : "";
    if (
      !nombreValido(nombreCompleto) ||
      nombreCompleto.trim().length > 120 ||
      !correoValido(correo)
    )
      return res.status(400).json({ mensaje: "Nombre sin números y correo válido obligatorios" });

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      typeof nombreCompleto !== "string" ||
      !nombreCompleto.trim() ||
      !Number.isInteger(idRol)
    ) {
      return res.status(400).json({
        mensaje: "Datos inválidos",
      });
    }

    conexion = await conectar();

    const rol = await conexion.execute(
      `SELECT ID_ROL FROM ROLES
       WHERE ID_ROL = :idRol AND ESTADO = 'A'`,
      { idRol },
    );

    if (rol.rows.length === 0) {
      return res.status(400).json({
        mensaje: "Rol no válido",
      });
    }

    // Evitar que el administrador cambie su propio rol.
    if (id === req.usuario.ID_USUARIO && idRol !== req.usuario.ID_ROL) {
      return res.status(400).json({
        mensaje: "No puedes cambiar tu propio rol",
      });
    }

    const resultado = await conexion.execute(
      `UPDATE USUARIOS
       SET NOMBRE_COMPLETO = :nombre,
           CORREO = :correo,
           ID_ROL = :idRol,
           SUELDO=CASE WHEN :laboral=1 THEN :sueldo ELSE SUELDO END,
           HORARIO=CASE WHEN :laboral=1 THEN :horario ELSE HORARIO END,
           PUESTO=CASE WHEN :laboral=1 THEN :puesto ELSE PUESTO END
       WHERE ID_USUARIO = :id AND (:actorRol IN (1,3) OR ID_ROL = :actorRol)`,
      {
        nombre: nombreCompleto.trim(),
        correo,
        idRol,
        ...trabajo,
        laboral: Object.hasOwn(req.body, "sueldo") ? 1 : 0,
        actorRol: req.usuario.ID_ROL,
        id,
      },
      { autoCommit: false },
    );

    if (resultado.rowsAffected === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }
    await encolar(
      conexion,
      correo,
      "Cuenta actualizada",
      "Los datos de tu cuenta en Librería La Crayola Gigante fueron actualizados por un usuario autorizado. Si no esperabas este cambio, contacta al administrador.",
    );
    await conexion.commit();

    return res.json({
      mensaje: "Usuario actualizado correctamente",
    });
  } catch (error) {
    if (conexion) await conexion.rollback();
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    if (error.errorNum === 1) {
      const correo =
        typeof req.body?.correo === "string" ? req.body.correo.trim().toLowerCase() : "";
      if (conexion && correo) await avisarDuplicado(conexion, correo);
      return res
        .status(409)
        .json({ mensaje: "El correo ya está registrado. No se puede asignar a otra cuenta." });
    }
    console.error(error.message);
    return res.status(500).json({
      mensaje: "Error al modificar usuario",
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

    if (!Number.isInteger(id) || id <= 0 || !["A", "I"].includes(estado)) {
      return res.status(400).json({
        mensaje: "Estado inválido",
      });
    }

    if (id === req.usuario.ID_USUARIO && estado === "I") {
      return res.status(400).json({
        mensaje: "No puedes desactivar tu propia cuenta",
      });
    }

    conexion = await conectar();

    const resultado = await conexion.execute(
      `UPDATE USUARIOS
       SET ESTADO = :estado
       WHERE ID_USUARIO = :id AND (:actorRol IN (1,3) OR ID_ROL = :actorRol)`,
      { estado, id, actorRol: req.usuario.ID_ROL },
      { autoCommit: true },
    );

    if (resultado.rowsAffected === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    return res.json({
      mensaje: "Estado actualizado correctamente",
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      mensaje: "Error al cambiar estado",
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

const eliminarUsuario = async (req, res) => {
  let c;
  try {
    const id=Number(req.params.id);
    exigir(Number.isSafeInteger(id)&&id>0,'Usuario inválido');
    exigir(id!==req.usuario.ID_USUARIO,'No puedes eliminar tu propia cuenta',403);
    c=await conectar();
    const {filas}=require('../services/db');
    const [u]=await filas(c,'SELECT id_usuario,nombre_usuario FROM usuarios WHERE id_usuario=:id FOR UPDATE',{id});
    exigir(u,'Usuario no encontrado',404);
    // Comprobar también referencias con ON DELETE CASCADE antes de borrar.
    const referencias=await filas(c,`SELECT t.relname tabla,a.attname columna FROM pg_constraint k
      JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ANY(k.conkey)
      WHERE k.contype='f' AND k.confrelid='usuarios'::regclass AND n.nspname='public'`);
    const quote=s=>'"'+s.replaceAll('"','""')+'"';
    for(const r of referencias){
      const vinculados=await filas(c,`SELECT 1 FROM public.${quote(r.TABLA)} WHERE ${quote(r.COLUMNA)}=:id LIMIT 1`,{id});
      exigir(!vinculados.length,'Este usuario tiene historial. Desactívalo para conservar sus operaciones.',409);
    }
    await c.execute('DELETE FROM usuarios WHERE id_usuario=:id',{id});
    await c.execute("INSERT INTO bitacora(id_usuario,accion,tabla_afectada,id_registro_afectado,detalle) VALUES (:actor,'USUARIO_ELIMINADO','USUARIOS',:id,:detalle)",{actor:req.usuario.ID_USUARIO,id,detalle:`Usuario sin operaciones: ${u.NOMBRE_USUARIO}`});
    await c.commit();res.json({mensaje:'Usuario eliminado'});
  }catch(e){if(c)await c.rollback();res.status(e.status||(e.code==='23503'?409:500)).json({mensaje:e.status?e.message:e.code==='23503'?'El usuario tiene historial; desactívalo.':'No se pudo eliminar el usuario'});}
  finally{if(c)await c.close();}
};

module.exports = {
  eliminarUsuario,
  rolesAsignables,
  listarUsuarios,
  crearUsuario,
  modificarUsuario,
  cambiarEstado,
};
