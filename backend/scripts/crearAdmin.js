
require("dotenv").config();

const oracledb = require("../src/config/driver");
const bcrypt = require("bcryptjs");
const readline = require("node:readline/promises");

async function crearAdministrador() {
  let conexion;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const nombre = (await rl.question(
      "Nombre completo: "
    )).trim();

    const usuario = (await rl.question(
      "Nombre de usuario: "
    )).trim();

    const contrasena = await rl.question(
      "Contraseña (mínimo 8 caracteres): "
    );

    if (!nombre || !usuario || contrasena.length < 8) {
      throw new Error(
        "Datos inválidos. La contraseña debe tener mínimo 8 caracteres."
      );
    }

    conexion = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });

    const existe = await conexion.execute(
      `SELECT COUNT(*) AS TOTAL
       FROM USUARIOS
       WHERE NOMBRE_USUARIO = :usuario`,
      { usuario },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existe.rows[0].TOTAL > 0) {
      throw new Error("Ese nombre de usuario ya existe.");
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
        1,
        'A',
        SYSTIMESTAMP
      )`,
      {
        nombre,
        usuario,
        hash
      },
      { autoCommit: true }
    );

    console.log("\nAdministrador creado correctamente.");

  } catch (error) {
    console.error("Error:", error.message);

  } finally {
    if (conexion) {
      await conexion.close();
    }

    rl.close();
  }
}

crearAdministrador();
