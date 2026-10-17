require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const driver = require("../src/config/driver");
const { conectar } = require("../src/services/db");
async function main() {
  const c = await conectar();
  try {
    if (driver.motor() === "postgres") {
      await c.execute(
        fs.readFileSync(path.join(__dirname, "../../database/004_imagenes_postgres.sql"), "utf8"),
      );
    } else {
      const r = await c.execute(
        "SELECT table_name FROM user_tables WHERE table_name='IMAGENES_PRODUCTOS'",
      );
      if (!r.rows.length)
        await c.execute(
          "CREATE TABLE imagenes_productos (id_producto NUMBER PRIMARY KEY REFERENCES productos(id_producto) ON DELETE CASCADE, contenido CLOB NOT NULL, actualizado_en TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)",
        );
    }
    await c.commit();
    console.log("Tabla de imágenes preparada; los productos existentes se conservan.");
  } finally {
    await c.close();
    await driver.cerrarPool();
  }
}
main().catch((e) => {
  console.error("Migración de imágenes:", e.code || e.name);
  process.exitCode = 1;
});
