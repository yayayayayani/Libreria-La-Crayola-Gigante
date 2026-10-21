require("dotenv").config({ quiet: true });
const driver = require("../src/config/driver");
const { conectar, filas } = require("../src/services/db");
async function main() {
  const c = await conectar();
  try {
    const postgres = driver.motor() === "postgres";
    if (postgres) await c.execute("SELECT pg_advisory_xact_lock(606007)");
    const restricciones = await filas(c, postgres
      ? "SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_schema=current_schema() AND table_name='detalle_compras' AND constraint_name='ck_recepcion_motivo'"
      : "SELECT constraint_name FROM user_constraints WHERE table_name='DETALLE_COMPRAS' AND constraint_name='CK_RECEPCION_MOTIVO'");
    if (restricciones.length)
      await c.execute("ALTER TABLE detalle_compras DROP CONSTRAINT ck_recepcion_motivo");
    await c.commit();
    console.log("Observaciones de recepción opcionales.");
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
    await driver.cerrarPool();
  }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
