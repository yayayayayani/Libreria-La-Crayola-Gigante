const oracledb = require("./driver");

async function probarConexion() {
  let conexion;

  try {
    conexion = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const resultado = await conexion.execute(
      oracledb.motor() === "postgres"
        ? "SELECT COUNT(*) AS TOTAL FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
        : "SELECT COUNT(*) AS TOTAL FROM USER_TABLES",
    );

    console.log(`Conexión con ${oracledb.motor()} establecida correctamente.`);
    console.log("Cantidad de tablas:", resultado.rows[0][0]);
  } catch (error) {
    console.error("Error conectando con la base de datos:", error.code || error.name);
  } finally {
    if (conexion) {
      await conexion.close();
    }
  }
}

module.exports = { probarConexion };
