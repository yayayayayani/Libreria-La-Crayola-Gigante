
const oracledb = require('../config/driver');
const { nombreValido, nitValido } = require('../services/validaciones');

const conectar = () => oracledb.getConnection({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
});

const normalizar = (valor) => {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto || null;
};

const validarCliente = (datos) => {
  const cliente = {
    nombres: normalizar(datos.nombres),
    apellidos: normalizar(datos.apellidos),
    nit: normalizar(datos.nit)?.toUpperCase() || null,
    telefono: normalizar(datos.telefono),
    correo: normalizar(datos.correo)?.toLowerCase() || null,
    direccion: normalizar(datos.direccion)
  };

  if (!cliente.nombres) {
    return { error: "El nombre es obligatorio" };
  }
  if (!nombreValido(cliente.nombres) || (cliente.apellidos && !nombreValido(cliente.apellidos))) {
    return { error: 'Los nombres y apellidos solo pueden contener letras, espacios, apóstrofes y guiones' };
  }
  if (cliente.telefono && !/^[+0-9 ()-]{8,25}$/.test(cliente.telefono)) return {error:'Teléfono inválido'};

  const limites = {
    nombres: 100,
    apellidos: 100,
    nit: 20,
    telefono: 25,
    correo: 120,
    direccion: 250
  };

  for (const [campo, limite] of Object.entries(limites)) {
    if (cliente[campo] &&
        Buffer.byteLength(cliente[campo], "utf8") > limite) {
      return {
        error: `El campo ${campo} supera el límite permitido`
      };
    }
  }

  if (cliente.correo &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.correo)) {
    return { error: "El correo electrónico no es válido" };
  }

  if (cliente.nit &&
      !nitValido(cliente.nit)) {
    return { error: "Formato de NIT inválido" };
  }

  if(cliente.nit) cliente.nit = cliente.nit.replace('-', '');

  return { cliente };
};

// LISTAR CLIENTES
const listarClientes = async (req, res) => {
  let conexion;

  try {
    conexion = await conectar();

    const resultado = await conexion.execute(
      `SELECT
         ID_CLIENTE,
         NOMBRES,
         APELLIDOS,
         NIT,
         TELEFONO,
         CORREO,
         DIRECCION,
         ESTADO,
         CREADO_EN
       FROM CLIENTES
       ORDER BY ID_CLIENTE DESC`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      mensaje: "Error al consultar clientes"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// CREAR CLIENTE
const crearCliente = async (req, res) => {
  let conexion;

  try {
    const { error, cliente } = validarCliente(req.body || {});

    if (error) {
      return res.status(400).json({ mensaje: error });
    }

    conexion = await conectar();

    const resultado = await conexion.execute(
      `INSERT INTO CLIENTES (
         NOMBRES,
         APELLIDOS,
         NIT,
         TELEFONO,
         CORREO,
         DIRECCION,
         ESTADO,
         CREADO_EN
       ) VALUES (
         :nombres,
         :apellidos,
         :nit,
         :telefono,
         :correo,
         :direccion,
         'A',
         SYSTIMESTAMP
       )
       RETURNING ID_CLIENTE INTO :id`,
      {
        ...cliente,
        id: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER
        }
      },
      { autoCommit: true }
    );

    return res.status(201).json({
      mensaje: "Cliente registrado correctamente",
      id: resultado.outBinds.id[0]
    });

  } catch (error) {
    if (error.errorNum === 1) {
      return res.status(409).json({
        mensaje: "El correo o NIT ya está registrado en otro cliente"
      });
    }

    console.error(error);
    return res.status(500).json({
      mensaje: "Error al registrar cliente"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// MODIFICAR CLIENTE
const modificarCliente = async (req, res) => {
  let conexion;

  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        mensaje: "ID de cliente inválido"
      });
    }

    const { error, cliente } = validarCliente(req.body || {});

    if (error) {
      return res.status(400).json({ mensaje: error });
    }

    conexion = await conectar();

    const resultado = await conexion.execute(
      `UPDATE CLIENTES SET
         NOMBRES = :nombres,
         APELLIDOS = :apellidos,
         NIT = :nit,
         TELEFONO = :telefono,
         CORREO = :correo,
         DIRECCION = :direccion
       WHERE ID_CLIENTE = :id`,
      { ...cliente, id },
      { autoCommit: true }
    );

    if (resultado.rowsAffected === 0) {
      return res.status(404).json({
        mensaje: "Cliente no encontrado"
      });
    }

    return res.json({
      mensaje: "Cliente actualizado correctamente"
    });

  } catch (error) {
    if (error.errorNum === 1) {
      return res.status(409).json({
        mensaje: "El correo o NIT ya está registrado en otro cliente"
      });
    }

    console.error(error);
    return res.status(500).json({
      mensaje: "Error al modificar cliente"
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

    if (!Number.isSafeInteger(id) || id <= 0 ||
        !["A", "I"].includes(estado)) {
      return res.status(400).json({
        mensaje: "Datos inválidos"
      });
    }

    conexion = await conectar();

    const resultado = await conexion.execute(
      `UPDATE CLIENTES
       SET ESTADO = :estado
       WHERE ID_CLIENTE = :id`,
      { estado, id },
      { autoCommit: true }
    );

    if (resultado.rowsAffected === 0) {
      return res.status(404).json({
        mensaje: "Cliente no encontrado"
      });
    }

    return res.json({
      mensaje: "Estado actualizado correctamente"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      mensaje: "Error al cambiar el estado"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

module.exports = {
  listarClientes,
  crearCliente,
  modificarCliente,
  cambiarEstado
};
