const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarCompra } = require("../src/services/validaciones");
const { documentoValido } = require("../src/services/validaciones");
const { normalizarTelefono } = require("../src/services/validaciones");
test("Teléfono guatemalteco agrega prefijo y exige ocho dígitos", () => {
  for (const valor of ["12341234", "1234-1234", "+502 1234-1234", "50212341234"])
    assert.equal(normalizarTelefono(valor), "+502 1234-1234");
  for (const valor of ["123", "123456789", "+503 1234-1234", "abcdefgh", 12341234])
    assert.throws(() => normalizarTelefono(valor), { status: 400 });
  assert.equal(normalizarTelefono(""), null);
});
test("Documento distingue DPI de NIT y acepta NIT de ocho caracteres con guion", () => {
  for (const nit of ["1234567-8", "12345678", "1234567-K", "1234567k"])
    assert.ok(documentoValido(nit, "NIT"));
  assert.ok(documentoValido("1234567890123", "DPI"));
  for (const dpi of ["123", "12345678901234", "123456789012K", "123456-7890123"])
    assert.equal(documentoValido(dpi, "DPI"), false);
  for (const nit of ["85907-8", "123456-7", "12345678-9", "12--3", "ABC", "CF", "1234567890123"])
    assert.equal(documentoValido(nit, "NIT"), false);
  assert.equal(documentoValido("12345678", "otro"), false);
});
test("Cuerpos y detalles malformados producen errores de validación 400", () => {
  for (const datos of [null, undefined, [], false, "compra"]) {
    assert.throws(() => validarCompra(datos), { status: 400 });
  }
  for (const detalle of [null, [], false, 3, "producto"]) {
    assert.throws(
      () =>
        validarCompra({
          idProveedor: 1,
          factura: "F1",
          clave: "1234567890123456",
          detalles: [detalle],
        }),
      { status: 400 },
    );
  }
});
