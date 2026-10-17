const { prepararImagen, guardarImagen } = require("../services/imagenes");

const oracledb = require("../config/driver");

const conectar = () =>
  oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
  });

function validarProducto(datos) {
  const { codigo, nombre, descripcion, precio, stock, idCategoria } = datos;

  if (
    typeof codigo !== "string" ||
    typeof nombre !== "string" ||
    !codigo.trim() ||
    !nombre.trim()
  ) {
    return { error: "El código y nombre son obligatorios" };
  }

  if (
    Buffer.byteLength(codigo.trim(), "utf8") > 50 ||
    Buffer.byteLength(nombre.trim(), "utf8") > 150 ||
    (descripcion != null &&
      (typeof descripcion !== "string" || Buffer.byteLength(descripcion, "utf8") > 250))
  ) {
    return { error: "Se excedió la longitud de un campo" };
  }

  const precioNumero = Number(precio);
  const stockNumero = Number(stock);
  const categoriaNumero = Number(idCategoria);

  if (
    !["number", "string"].includes(typeof precio) ||
    precio === "" ||
    precio === null ||
    !Number.isFinite(precioNumero) ||
    precioNumero < 0 ||
    precioNumero > 99999999.99 ||
    !/^\d+(\.\d{1,2})?$/.test(String(precio))
  ) {
    return { error: "Ingresa un precio válido con máximo 2 decimales" };
  }

  if (
    stock === "" ||
    stock === null ||
    !Number.isSafeInteger(stockNumero) ||
    stockNumero < 0 ||
    stockNumero > 9999999999 ||
    !["number", "string"].includes(typeof stock) ||
    !/^\d+$/.test(String(stock))
  ) {
    return { error: "El stock debe ser un entero entre 0 y 9999999999" };
  }

  if (
    !["number", "string"].includes(typeof idCategoria) ||
    !Number.isSafeInteger(categoriaNumero) ||
    categoriaNumero <= 0
  ) {
    return { error: "Selecciona una categoría válida" };
  }

  return {
    producto: {
      codigo: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      precio: precioNumero,
      stock: stockNumero,
      idCategoria: categoriaNumero,
    },
  };
}

async function categoriaActiva(conexion, id) {
  const resultado = await conexion.execute(
    `SELECT ID_CATEGORIA
     FROM CATEGORIAS
     WHERE ID_CATEGORIA = :id AND ESTADO = 'A'`,
    { id },
  );

  return resultado.rows.length > 0;
}

// CONSULTAR PRODUCTOS
const listarProductos = async (req, res) => {
  let conexion;

  try {
    conexion = await conectar();

    const resultado = await conexion.execute(
      `SELECT
         p.ID_PRODUCTO,
         p.CODIGO,
         p.NOMBRE,
         p.DESCRIPCION,
         p.PRECIO,
         p.STOCK,
         p.ID_CATEGORIA,
         (SELECT i.actualizado_en FROM imagenes_productos i WHERE i.id_producto=p.id_producto) AS IMAGEN_ACTUALIZADA,
         c.NOMBRE AS CATEGORIA,
         p.ESTADO,
         p.CREADO_EN
       FROM PRODUCTOS p
       INNER JOIN CATEGORIAS c
         ON p.ID_CATEGORIA = c.ID_CATEGORIA
       ORDER BY p.ID_PRODUCTO DESC`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      mensaje: "Error al consultar productos",
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// CREAR PRODUCTO
const crearProducto = async (req, res) => {
  let conexion;

  try {
    const { error, producto } = validarProducto(req.body || {});

    if (error) {
      return res.status(400).json({ mensaje: error });
    }

    const imagen = await prepararImagen(req.body?.imagen);
    conexion = await conectar();

    if (!(await categoriaActiva(conexion, producto.idCategoria))) {
      return res.status(400).json({
        mensaje: "La categoría no existe o está inactiva",
      });
    }

    const resultado = await conexion.execute(
      `INSERT INTO PRODUCTOS (
         CODIGO, NOMBRE, DESCRIPCION,
         PRECIO, STOCK, ID_CATEGORIA,
         ESTADO, CREADO_EN
       ) VALUES (
         :codigo, :nombre, :descripcion,
         :precio, :stock, :idCategoria,
         'A', SYSTIMESTAMP
       )
       RETURNING ID_PRODUCTO INTO :id`,
      {
        ...producto,
        id: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER,
        },
      },
      { autoCommit: false },
    );

    await conexion.execute(
      `INSERT INTO movimientos_inventario(id_producto,id_usuario,tipo,cantidad,stock_anterior,stock_nuevo) VALUES (:id,:usuario,'APERTURA',:stock,0,:stock)`,
      { id: resultado.outBinds.id[0], usuario: req.usuario.ID_USUARIO, stock: producto.stock },
    );
    await guardarImagen(conexion, resultado.outBinds.id[0], imagen);
    await conexion.commit();

    res.status(201).json({
      mensaje: "Producto creado correctamente",
      id: resultado.outBinds.id[0],
    });
  } catch (error) {
    if (conexion) await conexion.rollback();
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    if (error.errorNum === 1) {
      return res.status(409).json({
        mensaje: "El código del producto ya existe",
      });
    }

    console.error(error);
    res.status(500).json({
      mensaje: "Error al crear producto",
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// MODIFICAR PRODUCTO
const modificarProducto = async (req, res) => {
  let conexion;

  try {
    const id = Number(req.params.id);
    const { error, producto } = validarProducto(req.body || {});

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        mensaje: "ID de producto inválido",
      });
    }

    if (error) {
      return res.status(400).json({ mensaje: error });
    }

    const imagen = await prepararImagen(req.body?.imagen);
    conexion = await conectar();

    if (!(await categoriaActiva(conexion, producto.idCategoria))) {
      return res.status(400).json({
        mensaje: "La categoría no existe o está inactiva",
      });
    }

    const resultado = await conexion.execute(
      `UPDATE PRODUCTOS SET
         CODIGO = :codigo,
         NOMBRE = :nombre,
         DESCRIPCION = :descripcion,
         PRECIO = :precio,
         ID_CATEGORIA = :idCategoria
       WHERE ID_PRODUCTO = :id`,
      {
        codigo: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precio: producto.precio,
        idCategoria: producto.idCategoria,
        id,
      },
      { autoCommit: false },
    );

    if (resultado.rowsAffected === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado",
      });
    }

    await guardarImagen(conexion, id, imagen);
    await conexion.commit();
    res.json({
      mensaje: "Producto actualizado correctamente",
    });
  } catch (error) {
    if (conexion) await conexion.rollback();
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    if (error.errorNum === 1) {
      return res.status(409).json({
        mensaje: "El código del producto ya existe",
      });
    }

    console.error(error);
    res.status(500).json({
      mensaje: "Error al modificar producto",
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

// ACTIVAR / DESACTIVAR
const cambiarEstado = async (req, res) => {
  let conexion;

  try {
    const id = Number(req.params.id);
    const { estado } = req.body || {};

    if (!Number.isSafeInteger(id) || id <= 0 || !["A", "I"].includes(estado)) {
      return res.status(400).json({
        mensaje: "Datos inválidos",
      });
    }

    conexion = await conectar();

    const resultado = await conexion.execute(
      `UPDATE PRODUCTOS
       SET ESTADO = :estado
       WHERE ID_PRODUCTO = :id`,
      { id, estado },
      { autoCommit: true },
    );

    if (resultado.rowsAffected === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado",
      });
    }

    res.json({
      mensaje: "Estado actualizado correctamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      mensaje: "Error al cambiar estado",
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

module.exports = {
  listarProductos,
  crearProducto,
  modificarProducto,
  cambiarEstado,
};
