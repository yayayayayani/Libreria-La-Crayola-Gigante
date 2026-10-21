const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarRecuperacion, resumenRecuperaciones } = require("../src/services/recuperaciones");
const base = { tipo: "NOTA_CREDITO", monto: 10.65, referencia: " nc-10 ", fechaDocumento: "2026-10-19", clave: "1234567890123456" };
test("valida documentos y montos sin aceptar fechas ni importes inválidos", () => {
  assert.equal(validarRecuperacion(base).referencia, "NC-10");
  for (const monto of [0, -1, 0.001, "10", true, NaN, Infinity])
    assert.throws(() => validarRecuperacion({ ...base, monto }), { status: 400 });
  for (const fechaDocumento of ["2026-02-30", "19/10/2026", "", null])
    assert.throws(() => validarRecuperacion({ ...base, fechaDocumento }), { status: 400 });
  assert.throws(() => validarRecuperacion({ ...base, tipo: "PERDIDA" }), { status: 400 });
  assert.throws(() => validarRecuperacion({ ...base, referencia: " " }), { status: 400 });
});
test("saldo usa centavos y distingue efectivo, crédito y pérdida", () => {
  assert.deepEqual(resumenRecuperaciones([{ CANTIDAD_DANADA: 3, COSTO: 0.1 }], [
    { TIPO: "NOTA_CREDITO", MONTO: 0.1 }, { TIPO: "PERDIDA", MONTO: 0.1 },
  ]), { rechazado: 0.3, acreditado: 0.1, reembolsado: 0, perdida: 0.1, pendiente: 0.1 });
});
