require("dotenv").config({ quiet: true });
const driver = require("../src/config/driver");
const { conectar, filas } = require("../src/services/db");
async function main() {
  const c = await conectar();
  const postgres = driver.motor() === "postgres";
  try {
    if (postgres) await c.execute("SELECT pg_advisory_xact_lock(606007)");
    if ((await filas(c, "SELECT nombre FROM migraciones WHERE nombre='007_fix_sprint2'")).length) {
      console.log("Corrección Sprint II ya aplicada.");
      return;
    }
    // En Oracle el DDL confirma implícitamente; cada paso se puede reanudar.
    for (const [nombre, tipo] of [
      ["cantidad_danada", postgres ? "NUMERIC(10) DEFAULT 0 NOT NULL" : "NUMBER(10) DEFAULT 0 NOT NULL"],
      ["observaciones", postgres ? "VARCHAR(500)" : "VARCHAR2(500 CHAR)"],
    ]) {
      const columnas = await filas(c, postgres
        ? "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='detalle_compras' AND column_name=:nombre"
        : "SELECT column_name FROM user_tab_columns WHERE table_name='DETALLE_COMPRAS' AND column_name=UPPER(:nombre)", { nombre });
      if (!columnas.length) await c.execute(`ALTER TABLE detalle_compras ADD ${nombre} ${tipo}`);
    }
    await c.execute("UPDATE productos SET stock_minimo=10 WHERE stock_minimo<10");
    await c.execute(postgres
      ? "ALTER TABLE productos ALTER COLUMN stock_minimo SET DEFAULT 10"
      : "ALTER TABLE productos MODIFY stock_minimo DEFAULT 10");
    for (const [tabla, nombre, condicion] of [
      ["productos", "ck_stock_minimo_10", "stock_minimo >= 10"],
      ["detalle_compras", "ck_recepcion_danadas", "cantidad_danada >= 0 AND cantidad_danada <= cantidad AND cantidad_danada = FLOOR(cantidad_danada)"],
    ]) {
      const restricciones = await filas(c, postgres
        ? "SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_schema=current_schema() AND constraint_name=:nombre"
        : "SELECT constraint_name FROM user_constraints WHERE constraint_name=UPPER(:nombre)", { nombre });
      if (!restricciones.length) await c.execute(`ALTER TABLE ${tabla} ADD CONSTRAINT ${nombre} CHECK (${condicion})`);
    }
    await c.execute("INSERT INTO migraciones(nombre) VALUES ('007_fix_sprint2')");
    await c.commit();
    console.log("Corrección Sprint II aplicada.");
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
    await driver.cerrarPool();
  }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
