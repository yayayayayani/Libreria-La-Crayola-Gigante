require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const driver = require("../src/config/driver");
const { conectar, filas } = require("../src/services/db");
async function main() {
  if (driver.motor() !== "postgres") throw new Error("Sprint 3 requiere PostgreSQL, motor activo del proyecto.");
  const c = await conectar();
  try {
    await c.execute("SELECT pg_advisory_xact_lock(606003)");
    if (!(await filas(c, "SELECT nombre FROM migraciones WHERE nombre='005_ventas'")).length)
      throw new Error("Ejecuta primero npm run migrate:sales");
    if (!(await filas(c, "SELECT nombre FROM migraciones WHERE nombre='006_sprint3'")).length) {
      const sql = fs.readFileSync(path.join(__dirname, "../../database/006_sprint3.sql"), "utf8");
      for (const statement of sql.split(";").filter((s) => s.trim())) await c.execute(statement);
    }
    if (!(await filas(c, "SELECT nombre FROM migraciones WHERE nombre='007_caja_puntos'")).length) {
      const sql = fs.readFileSync(path.join(__dirname, "../../database/007_caja_puntos.sql"), "utf8");
      for (const statement of sql.split(";").filter((s) => s.trim())) await c.execute(statement);
    }
    if (!(await filas(c, "SELECT nombre FROM migraciones WHERE nombre='008_iva_incluido'")).length) {
      const sql = fs.readFileSync(path.join(__dirname, "../../database/008_iva_incluido.sql"), "utf8");
      for (const statement of sql.split(";").filter((s) => s.trim())) await c.execute(statement);
    }
    if (!(await filas(c, "SELECT nombre FROM migraciones WHERE nombre='009_comprobantes'")).length) {
      const sql = fs.readFileSync(path.join(__dirname, "../../database/009_comprobantes.sql"), "utf8");
      for (const statement of sql.split(";").filter((s) => s.trim())) await c.execute(statement);
    }
    if (!(await filas(c, "SELECT nombre FROM migraciones WHERE nombre='010_finanzas'")).length) {
      const sql = fs.readFileSync(path.join(__dirname, "../../database/010_finanzas.sql"), "utf8");
      for (const statement of sql.split(";").filter((s) => s.trim())) await c.execute(statement);
    }
    if (!(await filas(c, "SELECT nombre FROM migraciones WHERE nombre='011_operacion'")).length) {
      const sql = fs.readFileSync(path.join(__dirname, "../../database/011_operacion.sql"), "utf8");
      for (const statement of sql.split(";").filter((s) => s.trim())) await c.execute(statement);
    }
    if (!(await filas(c, "SELECT nombre FROM migraciones WHERE nombre='012_caja_dueno'")).length) {
      const sql = fs.readFileSync(path.join(__dirname, "../../database/012_caja_dueno.sql"), "utf8");
      for (const statement of sql.split(";").filter((s) => s.trim())) await c.execute(statement);
    }
    await c.commit();
    console.log("Sprint 3 preparado.");
  } catch (e) { await c.rollback(); throw e; }
  finally { await c.close(); await driver.cerrarPool(); }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
