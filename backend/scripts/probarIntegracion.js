// Copia únicamente la estructura y los catálogos de permisos y roles.
// Nunca copia usuarios, contraseñas, clientes ni operaciones del negocio.
require("dotenv").config({ quiet: true });
const { Client } = require("pg");
const { randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { opcionesPostgres } = require("../src/config/driver");
async function main(files) {
  const schema = `sprint4_test_${randomBytes(8).toString("hex")}`;
  const c = new Client(opcionesPostgres(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL));
  let creado = false;
  await c.connect();
  try {
    const { rows: tables } = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    if (!tables.some(t => t.tablename === "pedidos")) throw new Error("No se encontró el esquema de referencia");
    const { rows: defaults } = await c.query("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND column_default LIKE '%nextval%'");
    if (defaults.length) throw new Error("No se copian secuencias compartidas: se requieren columnas identity");
    const quote = v => '"' + v.replaceAll('"', '""') + '"';
    await c.query("BEGIN");
    await c.query(`CREATE SCHEMA ${quote(schema)}`);
    await c.query(`SET LOCAL search_path TO ${quote(schema)}`);
    for (const { tablename } of tables) await c.query(`CREATE TABLE ${quote(tablename)} (LIKE public.${quote(tablename)} INCLUDING ALL)`);
    const { rows: fks } = await c.query(`SELECT t.relname,pg_get_constraintdef(k.oid) def FROM pg_constraint k
      JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND k.contype='f'`);
    for (const fk of fks) await c.query(`ALTER TABLE ${quote(fk.relname)} ADD ${fk.def.replaceAll('public.', quote(schema) + '.')}`);
    for (const table of ["roles", "permisos", "rol_permiso"]) await c.query(`INSERT INTO ${quote(table)} SELECT * FROM public.${quote(table)}`);
    for (const [table, column] of [["roles", "id_rol"], ["permisos", "id_permiso"]]) {
      await c.query(`SELECT setval(pg_get_serial_sequence($1,$2),(SELECT MAX(${column}) FROM ${table}))`, [table, column]);
    }
    await c.query("COMMIT"); creado = true;
    console.log("Esquema temporal creado con estructura y permisos; sin datos del negocio.");
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--require", "./tests/test-schema.cjs", "--test", "--test-concurrency=1", "--test-timeout=180000", ...files], {
        cwd: path.resolve(__dirname, ".."), stdio: "inherit", timeout: 900000,
        env: { ...process.env, DB_ENGINE: "postgres", CRAYOLA_TEST_SCHEMA: schema, JWT_SECRET: randomBytes(32).toString("hex") },
      });
      child.once("error", reject); child.once("exit", code => resolve(code ?? 1));
    });
    if (code) process.exitCode = code;
  } finally {
    await c.query("ROLLBACK");
    if (creado) {
      // El identificador se genera aquí; jamás se acepta un esquema del usuario.
      if (!/^sprint4_test_[a-f0-9]{16}$/.test(schema)) throw new Error("Esquema inesperado");
      await c.query(`DROP SCHEMA "${schema}" CASCADE`);
      console.log("Esquema temporal de pruebas eliminado.");
    }
    await c.end();
  }
}
const files = process.argv.slice(2);
const suites = files.length ? files : ["tests/sprint2.test.js", "tests/sprint3.test.js", "tests/sprint4.integration.test.js"];
// Cada suite tiene su propio esquema; sus datos no afectan otras pruebas.
Promise.all(suites.map(file => main([file]).catch(e => {
  console.error("Pruebas de integración:", file, e.code || e.message); process.exitCode = 1;
})));

