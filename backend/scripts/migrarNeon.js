// Copia consistente de Oracle a PostgreSQL. No modifica Oracle ni reemplaza datos.
require("dotenv").config({ quiet: true });
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const oracle = require("oracledb");
const { Client } = require("pg");
const { opcionesPostgres } = require("../src/config/driver");
const tablas = [
  "ROLES",
  "PERMISOS",
  "CATEGORIAS",
  "CLIENTES",
  "PROVEEDORES",
  "USUARIOS",
  "ROL_PERMISO",
  "PRODUCTOS",
  "COMPRAS",
  "DETALLE_COMPRAS",
  "RECEPCIONES",
  "MOVIMIENTOS_INVENTARIO",
  "BITACORA",
  "CORREOS_PENDIENTES",
  "MIGRACIONES",
];
const identidad = {
  ROLES: "ID_ROL",
  PERMISOS: "ID_PERMISO",
  CATEGORIAS: "ID_CATEGORIA",
  CLIENTES: "ID_CLIENTE",
  PROVEEDORES: "ID_PROVEEDOR",
  USUARIOS: "ID_USUARIO",
  PRODUCTOS: "ID_PRODUCTO",
  COMPRAS: "ID_COMPRA",
  DETALLE_COMPRAS: "ID_DETALLE",
  RECEPCIONES: "ID_RECEPCION",
  MOVIMIENTOS_INVENTARIO: "ID_MOVIMIENTO",
  BITACORA: "ID_BITACORA",
  CORREOS_PENDIENTES: "ID_CORREO",
};
const fecha = (c) => c.DATA_TYPE.startsWith("TIMESTAMP") || c.DATA_TYPE === "DATE";
function identificador(n) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(n)) throw new Error("Identificador inesperado");
  return n;
}
function seleccion(cols, pg = false) {
  return cols
    .map((c) => {
      const n = identificador(c.COLUMN_NAME);
      if (!fecha(c)) return n;
      return `TO_CHAR(${n},'YYYY-MM-DD HH24:MI:SS.${pg ? "US" : "FF6"}') AS ${n}`;
    })
    .join(",");
}
function canonico(rows, cols) {
  return rows
    .map((row) =>
      JSON.stringify(
        cols.map((c) => {
          let v = row[c.COLUMN_NAME] ?? row[c.COLUMN_NAME.toLowerCase()] ?? null;
          if (v !== null && c.DATA_TYPE === "NUMBER") {
            v = Number(v);
            if (!Number.isFinite(v) || (Number.isInteger(v) && !Number.isSafeInteger(v)))
              throw new Error("Número fuera del rango seguro");
          }
          return v;
        }),
      ),
    )
    .sort();
}
function hash(rows) {
  return crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
async function main() {
  let origen, destino, backupPath;
  try {
    const url = process.env.NEON_DATABASE_URL;
    if (!url) throw new Error("Falta NEON_DATABASE_URL en backend/.env");
    if (new URL(url).hostname.includes("-pooler."))
      throw new Error("Usar la conexión directa de Neon, sin -pooler");
    destino = new Client(opcionesPostgres(url));
    await destino.connect();
    // Serializar migraciones y rechazar cualquier tabla de aplicación preexistente.
    await destino.query("BEGIN");
    await destino.query("SELECT pg_advisory_xact_lock(740021337)");
    const existentes = await destino.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
      [tablas.map((t) => t.toLowerCase())],
    );
    if (existentes.rows.length)
      throw new Error(
        "Destino ya contiene tablas de la aplicación. No se sobrescribió nada; usar una base vacía o verificar la migración existente.",
      );
    origen = await oracle.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });
    origen.callTimeout = 30000;
    await origen.execute("SET TRANSACTION READ ONLY");
    const data = { version: 1, fecha: new Date().toISOString(), tablas: {} };
    for (const tabla of tablas) {
      const meta = await origen.execute(
        "SELECT COLUMN_NAME,DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME=:tabla ORDER BY COLUMN_ID",
        { tabla },
        { outFormat: oracle.OUT_FORMAT_OBJECT },
      );
      if (!meta.rows.length) throw new Error(`Falta tabla de origen: ${tabla}`);
      if (
        meta.rows.some(
          (c) =>
            !["NUMBER", "VARCHAR2", "CHAR", "DATE"].includes(c.DATA_TYPE) &&
            !c.DATA_TYPE.startsWith("TIMESTAMP"),
        )
      )
        throw new Error(`Tipo no soportado en ${tabla}`);
      const r = await origen.execute(
        `SELECT ${seleccion(meta.rows)} FROM ${tabla}`,
        {},
        { outFormat: oracle.OUT_FORMAT_OBJECT, resultSet: true },
      );
      const rows = [];
      try {
        let lote;
        while ((lote = await r.resultSet.getRows(500)).length) rows.push(...lote);
      } finally {
        await r.resultSet.close();
      }
      canonico(rows, meta.rows);
      data.tablas[tabla] = { columnas: meta.rows, rows };
    }
    const dir = path.resolve(__dirname, "../../.migration-backups");
    fs.mkdirSync(dir, { recursive: true });
    backupPath = path.join(dir, `oracle-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(data), { flag: "wx", mode: 0o600 });
    console.log("Respaldo local creado en .migration-backups (excluido de Git).");
    await destino.query(
      fs.readFileSync(path.join(__dirname, "../../database/003_postgres.sql"), "utf8"),
    );
    const resumen = [];
    for (const tabla of tablas) {
      const { columnas, rows } = data.tablas[tabla],
        nombre = tabla.toLowerCase();
      const target = await destino.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [nombre],
      );
      if (
        target.rows.length !== columnas.length ||
        columnas.some(
          (c) => !target.rows.some((t) => t.column_name === c.COLUMN_NAME.toLowerCase()),
        )
      )
        throw new Error(`Columnas incompatibles: ${tabla}`);
      const names = columnas.map((c) => c.COLUMN_NAME.toLowerCase());
      for (let start = 0; start < rows.length; start += 200) {
        const values = [];
        const grupos = rows.slice(start, start + 200).map(
          (row) =>
            "(" +
            columnas
              .map((c) => {
                values.push(row[c.COLUMN_NAME]);
                return "$" + values.length;
              })
              .join(",") +
            ")",
        );
        await destino.query(
          `INSERT INTO ${nombre}(${names.join(",")}) VALUES ${grupos.join(",")}`,
          values,
        );
      }
      if (identidad[tabla]) {
        const col = identidad[tabla].toLowerCase();
        await destino.query(
          `SELECT setval(pg_get_serial_sequence($1,$2),COALESCE(MAX(${col}),1),COUNT(*)>0) FROM ${nombre}`,
          [nombre, col],
        );
      }
      const copied = await destino.query(`SELECT ${seleccion(columnas, true)} FROM ${nombre}`);
      const sourceHash = hash(canonico(rows, columnas)),
        targetHash = hash(canonico(copied.rows, columnas));
      if (rows.length !== copied.rows.length || sourceHash !== targetHash)
        throw new Error(`La verificación de datos falló: ${tabla}`);
      resumen.push({ tabla, registros: rows.length, verificacion: "coinciden todas las columnas" });
      console.log(`${tabla}: ${rows.length} registros verificados`);
    }
    await destino.query("INSERT INTO migraciones(nombre) VALUES ('003_oracle_a_postgres')");
    await destino.query("COMMIT");
    const informe = {
      fecha: new Date().toISOString(),
      motor: "PostgreSQL",
      tablas: resumen,
      oracle: "sin modificaciones",
      correo: "no se enviaron mensajes",
      respaldo: path.basename(backupPath),
    };
    fs.writeFileSync(
      path.join(__dirname, "../../docs/sprint2/MIGRACION_NEON_RESULTADO.json"),
      JSON.stringify(informe, null, 2) + "\n",
    );
    console.log("Migración confirmada. Oracle intacto. No se cambió DB_ENGINE automáticamente.");
  } catch (e) {
    if (destino) await destino.query("ROLLBACK").catch(() => {});
    console.error(
      "Migración detenida:",
      e.code || (String(e.message).includes("://") ? "Error de conexión" : e.message),
    );
    process.exitCode = 1;
  } finally {
    if (origen) {
      await origen.rollback();
      await origen.close();
    }
    if (destino) await destino.end();
  }
}
if (require.main === module) main();
module.exports = { canonico, seleccion, tablas };
