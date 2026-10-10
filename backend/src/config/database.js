
const oracledb = require("oracledb");

async function probarConexion() {
  let conexion;

  try {
    conexion = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });

    const resultado = await conexion.execute(
      "SELECT COUNT(*) AS TOTAL FROM USER_TABLES"
    );

    console.log("Conexión con Oracle establecida correctamente.");
    console.log("Cantidad de tablas:", resultado.rows[0][0]);

  } catch (error) {
    console.error("Error conectando con Oracle:", error.message);
  } finally {
    if (conexion) {
      await conexion.close();
    }
  }
}

module.exports = { probarConexion };
