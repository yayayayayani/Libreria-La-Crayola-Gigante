const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarCompra } = require("../src/services/validaciones");
const compra = (detalle = {}) => validarCompra({
  idProveedor: 1, factura: "PRUEBA", clave: "1234567890123456",
  detalles: [{ idProducto: 1, cantidad: 80, costo: 2, ...detalle }],
});
test("80 recibidas con 10 dañadas conserva factura y acepta 70", () => {
  const r = compra({ cantidadDanada: 10, observaciones: "  Lápices rotos  " });
  assert.equal(r.total, 160);
  assert.equal(r.detalles[0].cantidad - r.detalles[0].cantidadDanada, 70);
  assert.equal(r.detalles[0].observaciones, "Lápices rotos");
  assert.equal(compra().detalles[0].cantidadDanada, 0);
  assert.equal(compra({ cantidadDanada: 80, observaciones: "Todos rotos" }).detalles[0].cantidadDanada, 80);
});
test("campos opcionales aceptan vacíos incluso cuando hay daños", () => {
  assert.equal(compra({ cantidadDanada: "" }).detalles[0].cantidadDanada, 0);
  for (const observaciones of ["", "   ", undefined])
    assert.equal(compra({ cantidadDanada: 10, observaciones }).detalles[0].observaciones, null);
});
test("rechaza daños fuera de rango, fracciones y observaciones inválidas", () => {
  for (const cantidadDanada of [-1, 81, 1.5, null, true, "10"])
    assert.throws(() => compra({ cantidadDanada, observaciones: "Rotos" }), { status: 400 });
  for (const observaciones of [null, 123, "x".repeat(501)])
    assert.throws(() => compra({ cantidadDanada: 10, observaciones }), { status: 400 });
});
