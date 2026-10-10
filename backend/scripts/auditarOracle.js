// Solo lectura: no muestra credenciales, contraseñas ni datos personales.
require("dotenv").config({ quiet: true });
const db = require("oracledb");
async function main() {
  let conexion;
  try {
    conexion = await db.getConnection({ user: process.env.DB_USER,
      password: process.env.DB_PASSWORD, connectString: process.env.DB_CONNECT_STRING });
    conexion.callTimeout = 10000;
    const consultas = {
      columnas: `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS
        WHERE TABLE_NAME IN ('USUARIOS','ROLES','PERMISOS','ROL_PERMISO') ORDER BY TABLE_NAME, COLUMN_ID`,
      restricciones: `SELECT c.TABLE_NAME, c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE, c.STATUS,
        cc.COLUMN_NAME, r.TABLE_NAME AS TABLA_REFERENCIADA
        FROM USER_CONSTRAINTS c JOIN USER_CONS_COLUMNS cc ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
        LEFT JOIN USER_CONSTRAINTS r ON c.R_CONSTRAINT_NAME = r.CONSTRAINT_NAME
        WHERE c.TABLE_NAME IN ('USUARIOS','ROLES','PERMISOS','ROL_PERMISO') ORDER BY c.TABLE_NAME, c.CONSTRAINT_NAME`,
      asignaciones: `SELECT r.ID_ROL, r.NOMBRE, r.ESTADO, p.CODIGO FROM ROLES r
        LEFT JOIN ROL_PERMISO rp ON rp.ID_ROL = r.ID_ROL
        LEFT JOIN PERMISOS p ON p.ID_PERMISO = rp.ID_PERMISO ORDER BY r.ID_ROL, p.CODIGO`,
      usuariosPorRol: `SELECT ID_ROL, ESTADO, COUNT(*) AS TOTAL FROM USUARIOS GROUP BY ID_ROL, ESTADO`,
      huerfanos: `SELECT
        (SELECT COUNT(*) FROM USUARIOS u WHERE NOT EXISTS (SELECT 1 FROM ROLES r WHERE r.ID_ROL = u.ID_ROL)) AS USUARIOS,
        (SELECT COUNT(*) FROM ROL_PERMISO rp WHERE NOT EXISTS (SELECT 1 FROM ROLES r WHERE r.ID_ROL = rp.ID_ROL)
          OR NOT EXISTS (SELECT 1 FROM PERMISOS p WHERE p.ID_PERMISO = rp.ID_PERMISO)) AS ASIGNACIONES FROM DUAL`,
      duplicados: `SELECT ID_ROL, ID_PERMISO, COUNT(*) AS TOTAL FROM ROL_PERMISO
        GROUP BY ID_ROL, ID_PERMISO HAVING COUNT(*) > 1`
    };
    for (const [nombre, sql] of Object.entries(consultas)) {
      const resultado = await conexion.execute(sql, {}, { outFormat: db.OUT_FORMAT_OBJECT });
      console.log(JSON.stringify({ consulta: nombre, filas: resultado.rows }));
    }
  } catch (error) {
    console.error("Auditoría Oracle pendiente/fallida:", error.code || error.name);
    process.exitCode = 1;
  } finally {
    if (conexion) await conexion.close();
  }
}
main();
