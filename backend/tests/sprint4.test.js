const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { auditar } = require("../src/services/auditoria");
const { rango } = require("../src/services/finanzas");
const app = require("../src/server");
let server;
after(async () => { if (server) await new Promise(r => server.close(r)); });
test("auditoría usa actor autenticado y parámetros; no confirma la transacción", async () => {
  const calls = [];
  await auditar({ execute: async (...args) => calls.push(args) }, { usuario: { ID_USUARIO: 17 } }, "CLIENTE_CREADO", "CLIENTES", 8, "' OR 1=1 --");
  assert.equal(calls.length, 1);
  assert.ok(!calls[0][0].includes("' OR 1=1"));
  assert.deepEqual(calls[0][1], { usuario: 17, accion: "CLIENTE_CREADO", tabla: "CLIENTES", id: 8, detalle: "' OR 1=1 --" });
});
test("rango rechaza fechas inexistentes, invertidas y entradas múltiples", () => {
  for (const q of [{ desde: "2026-02-30", hasta: "2026-03-01" }, { desde: "2026-03-01", hasta: "2026-02-01" }, { desde: ["2026-01-01"], hasta: "2026-02-01" }]) assert.throws(() => rango(q), { status: 400 });
});
test("API responde JSON en 404, JSON malformado y acceso anónimo", async () => {
  server = app.listen(0, "127.0.0.1"); await new Promise(r => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  // Las rutas autenticadas rechazan antes de consultar la base.
  for (const path of ["/dashboard/resumen", "/reportes/sprint4/inventario", "/auditoria"]) {
    const r = await fetch(base + path); assert.equal(r.status, 401); assert.ok((await r.json()).mensaje);
  }
  const bad = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(bad.status, 400); assert.match((await bad.json()).mensaje, /JSON/);
});
