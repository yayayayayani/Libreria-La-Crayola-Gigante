const { exigir, entero } = require("./validaciones");
function validarPedido(b) {
  exigir(b && (b.idCliente === null || entero(b.idCliente)), "Selecciona un cliente activo");
  validarClave(b.clave);
  exigir(typeof b.descuento === "number" && Number.isFinite(b.descuento) &&
    b.descuento >= 0 && b.descuento <= 50 && Math.abs(b.descuento * 100 - Math.round(b.descuento * 100)) < 1e-8,
  "Descuento inválido (0 a 50 %, dos decimales)");
  exigir(Array.isArray(b.detalles) && b.detalles.length > 0 && b.detalles.length <= 100, "Agrega entre 1 y 100 productos");
  const ids = new Set();
  for (const d of b.detalles) {
    exigir(d && entero(d.idProducto) && entero(d.cantidad, 1, 1000000) && !ids.has(d.idProducto), "Producto repetido o cantidad inválida");
    ids.add(d.idProducto);
  }
  return [...b.detalles].sort((a, z) => a.idProducto - z.idProducto);
}
function validarClave(clave) {
  exigir(typeof clave === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(clave), "Clave de operación inválida");
}
function calcular(detalles, descuento) {
  const centavos = detalles.reduce((sum, d) => sum + Math.round(d.precio * 100) * d.cantidad, 0);
  exigir(Number.isSafeInteger(centavos) && centavos > 0 && centavos <= 999999999999, "Total fuera del límite");
  const total = Math.round(centavos * (10000 - Math.round(descuento * 100)) / 10000) / 100;
  exigir(total > 0, "Total debe ser positivo");
  return { subtotal: centavos / 100, total, estado: descuento > 10 || total >= 5000 ? "PENDIENTE_APROBACION" : "APROBADO" };
}
function validarPago(b) {
  validarClave(b.clave);
  exigir(typeof b.monto === "number" && Number.isFinite(b.monto) && (b.monto > 0 || (b.monto === 0 && b.puntos > 0)) &&
    b.monto <= 9999999999.99 && Math.abs(b.monto * 100 - Math.round(b.monto * 100)) < 1e-6, "Monto inválido");
  exigir(["EFECTIVO", "TARJETA", "TRANSFERENCIA"].includes(b.metodo), "Método inválido");
  exigir(typeof (b.referencia ?? "") === "string" && (b.referencia || "").length <= 100, "Referencia inválida");
  exigir(b.monto === 0 || b.metodo === "EFECTIVO" || b.referencia?.trim(), "La referencia es obligatoria");
}
module.exports = { validarPedido, validarClave, calcular, validarPago };
