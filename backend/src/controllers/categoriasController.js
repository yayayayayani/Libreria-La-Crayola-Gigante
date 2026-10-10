
const oracledb = require("oracledb");

const conectar = () => oracledb.getConnection({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING
});

const listarCategorias = async (req, res) => {
  let conexion;

  try {
    conexion = await conectar();

    const resultado = await conexion.execute(
      `SELECT ID_CATEGORIA, NOMBRE, DESCRIPCION, ESTADO
       FROM CATEGORIAS
       ORDER BY NOMBRE`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      mensaje: "Error al consultar categorías"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

const crearCategoria = async (req, res) => {
  let conexion;

  try {
    const { nombre, descripcion } = req.body || {};

    if (typeof nombre !== "string" ||
        !nombre.trim() ||
        Buffer.byteLength(nombre.trim(), "utf8") > 100 ||
        (descripcion != null &&
          (typeof descripcion !== "string" ||
           Buffer.byteLength(descripcion, "utf8") > 250))) {
      return res.status(400).json({
        mensaje: "Verifica el nombre y la descripción"
      });
    }

    conexion = await conectar();

    await conexion.execute(
      `INSERT INTO CATEGORIAS
       (NOMBRE, DESCRIPCION, ESTADO)
       VALUES (:nombre, :descripcion, 'A')`,
      {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null
      },
      { autoCommit: true }
    );

    res.status(201).json({
      mensaje: "Categoría registrada correctamente"
    });
  } catch (error) {
    if (error.errorNum === 1) {
      return res.status(409).json({
        mensaje: "Ya existe una categoría con ese nombre"
      });
    }

    console.error(error);
    res.status(500).json({
      mensaje: "Error al crear categoría"
    });
  } finally {
    if (conexion) await conexion.close();
  }
};

module.exports = {
  listarCategorias,
  crearCategoria
};
