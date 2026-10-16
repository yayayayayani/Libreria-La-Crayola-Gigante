require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { conectar, filas } = require('../src/services/db');
async function main() {
  if(process.env.DB_ENGINE === 'postgres') throw new Error('Este migrador es exclusivo de Oracle. Para Neon usar migrate:neon.');
  const c = await conectar();
  try {
    // DDL Oracle confirma implícitamente: detectar conflictos antes de modificar.
    for (const tabla of ['CLIENTES']) {
      const duplicados = await filas(c, `SELECT COUNT(*) TOTAL FROM (SELECT LOWER(TRIM(correo)) FROM ${tabla} WHERE TRIM(correo) IS NOT NULL GROUP BY LOWER(TRIM(correo)) HAVING COUNT(*) > 1)`);
      if (duplicados[0].TOTAL) throw new Error('Existen correos duplicados en clientes. Corregir antes de migrar. No se modificaron esos registros.');
    }
    const existe = await filas(c, "SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME = 'MIGRACIONES'");
    if (!existe.length) await c.execute('CREATE TABLE migraciones (nombre VARCHAR2(100) PRIMARY KEY, aplicado_en TIMESTAMP DEFAULT SYSTIMESTAMP)');
    if ((await filas(c, "SELECT nombre FROM migraciones WHERE nombre = '002_sprint2'")).length) { console.log('Sprint 2 ya aplicado.'); return; }
    const sql = fs.readFileSync(path.join(__dirname,'../../database/002_sprint2.sql'),'utf8').replace(/^--.*$/gm,'');
    for (const sentencia of sql.split(';').map(s=>s.trim()).filter(Boolean)) {
      try { await c.execute(sentencia); }
      catch (e) { // Permite reanudar DDL; nunca ignora errores de datos.
        if (!([955,1430].includes(e.errorNum) && /^(CREATE|ALTER)/i.test(sentencia))) throw e;
      }
    }
    await c.execute("INSERT INTO migraciones(nombre) VALUES ('002_sprint2')");
    await c.commit(); console.log('Migración Sprint 2 aplicada.');
  } catch(e) { await c.rollback(); console.error(e.message); process.exitCode=1; }
  finally { await c.close(); }
}
main();
