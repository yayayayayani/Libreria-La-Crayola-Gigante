const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const driver = require("../src/config/driver");
const { canonico } = require("../scripts/migrarNeon");
test("parámetros repetidos son posicionales y los valores nunca se interpolan", () => {
  const q = driver.preparar(
    "SELECT * FROM usuarios WHERE id_usuario=:id OR id_rol=:id AND nombre_usuario=:nombre",
    { id: 4, nombre: "' OR 1=1 --" },
  );
  assert.equal(
    q.text,
    "SELECT * FROM usuarios WHERE id_usuario=$1 OR id_rol=$1 AND nombre_usuario=$2",
  );
  assert.deepEqual(q.values, [4, "' OR 1=1 --"]);
});
test("no modifica cadenas, comentarios, identificadores citados ni casts", () => {
  const sql = `SELECT ':id SYSTIMESTAMP', "SYSTIMESTAMP", :id::bigint -- :secreto\n/* :otro */`;
  assert.equal(
    driver.preparar(sql, { id: 2 }).text,
    `SELECT ':id SYSTIMESTAMP', "SYSTIMESTAMP", $1::bigint -- :secreto\n/* :otro */`,
  );
});
test("RETURNING, hora local y cadena vacía mantienen el contrato", () => {
  const q = driver.preparar(
    "INSERT INTO t(nombre,fecha) VALUES (:nombre,SYSTIMESTAMP) RETURNING id INTO :salida",
    { nombre: "", salida: { dir: driver.BIND_OUT } },
  );
  assert.equal(q.text, "INSERT INTO t(nombre,fecha) VALUES ($1,LOCALTIMESTAMP) RETURNING id");
  assert.deepEqual(q.values, [null]);
  assert.deepEqual(q.salida, { col: "id", key: "salida" });
});
test("rechaza parámetros ausentes", () =>
  assert.throws(() => driver.preparar("SELECT :id", {}), /ausente/));
test("TLS remoto valida certificado incluso si la URL pide require", () => {
  const config = driver.opcionesPostgres(
    "postgresql://test:dummy@example.invalid/db?sslmode=require&channel_binding=require",
  );
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.enableChannelBinding, true);
  assert.ok(!config.connectionString.includes("sslmode"));
});
test("verificación compara números normalizados, filas desordenadas y todos los campos", () => {
  const cols = [
    { COLUMN_NAME: "ID", DATA_TYPE: "NUMBER" },
    { COLUMN_NAME: "NOMBRE", DATA_TYPE: "VARCHAR2" },
  ];
  assert.deepEqual(
    canonico(
      [
        { ID: 2, NOMBRE: "B" },
        { ID: 1, NOMBRE: "A" },
      ],
      cols,
    ),
    canonico(
      [
        { id: "1", nombre: "A" },
        { id: "2", nombre: "B" },
      ],
      cols,
    ),
  );
  assert.notDeepEqual(
    canonico([{ ID: 1, NOMBRE: "A" }], cols),
    canonico([{ id: "1", nombre: "C" }], cols),
  );
});
test("adapter conserva transacción, IDs numéricos y nombres JSON", async (t) => {
  const prevEngine = process.env.DB_ENGINE,
    prevURL = process.env.DATABASE_URL;
  process.env.DB_ENGINE = "postgres";
  process.env.DATABASE_URL = "postgresql://test:dummy@localhost/test";
  const calls = [];
  let released = false;
  t.mock.method(Pool.prototype, "connect", async () => ({
    async query(q) {
      calls.push(typeof q === "string" ? q : q.text);
      return typeof q === "string"
        ? {}
        : { rows: [["42"]], fields: [{ name: "id", dataTypeID: 20 }], rowCount: 1 };
    },
    release() {
      released = true;
    },
  }));
  try {
    const c = await driver.getConnection();
    const r = await c.execute(
      "INSERT INTO t(n) VALUES (:n) RETURNING id INTO :id",
      { n: 1, id: { dir: driver.BIND_OUT } },
      { outFormat: driver.OUT_FORMAT_OBJECT },
    );
    assert.deepEqual(r.rows, [{ ID: 42 }]);
    assert.deepEqual(r.outBinds.id, [42]);
    assert.equal(r.rowsAffected, 1);
    await c.commit();
    await c.close();
    assert.deepEqual(calls, ["BEGIN", "INSERT INTO t(n) VALUES ($1) RETURNING id", "COMMIT"]);
    assert.ok(released);
  } finally {
    await driver.cerrarPool();
    if (prevEngine === undefined) delete process.env.DB_ENGINE;
    else process.env.DB_ENGINE = prevEngine;
    if (prevURL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevURL;
  }
});
test("cierre revierte y conflicto PostgreSQL mantiene HTTP 409 compatible", async (t) => {
  const prevEngine = process.env.DB_ENGINE,
    prevURL = process.env.DATABASE_URL;
  process.env.DB_ENGINE = "postgres";
  process.env.DATABASE_URL = "postgresql://test:dummy@localhost/test";
  const calls = [];
  t.mock.method(Pool.prototype, "connect", async () => ({
    async query(q) {
      calls.push(typeof q === "string" ? q : q.text);
      if (typeof q !== "string") {
        const e = new Error("duplicado");
        e.code = "23505";
        throw e;
      }
      return {};
    },
    release() {
      calls.push("release");
    },
  }));
  try {
    const c = await driver.getConnection();
    await assert.rejects(c.execute("INSERT INTO t VALUES (:n)", { n: 1 }), (e) => e.errorNum === 1);
    await c.close();
    assert.deepEqual(calls, ["BEGIN", "INSERT INTO t VALUES ($1)", "ROLLBACK", "release"]);
  } finally {
    await driver.cerrarPool();
    if (prevEngine === undefined) delete process.env.DB_ENGINE;
    else process.env.DB_ENGINE = prevEngine;
    if (prevURL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevURL;
  }
});
after(() => driver.cerrarPool());
