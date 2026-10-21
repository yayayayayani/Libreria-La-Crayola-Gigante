const { exigir, entero } = require("./validaciones");
const { validarClave } = require("./pedidos");
function fechaValida(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
}
function rango(q) {
  exigir(fechaValida(q.desde) && fechaValida(q.hasta) && q.desde <= q.hasta, "Selecciona un rango de fechas válido");
  return { desde: q.desde, hasta: q.hasta };
}
function validarMovimiento(b) {
  validarClave(b.clave);
  exigir(["EFECTIVO", "TARJETA", "TRANSFERENCIA"].includes(b.metodo), "Método inválido");
  const tipos = { OTRO_INGRESO: "INGRESO", GASTO: "EGRESO", RETIRO: "EGRESO", COMPRA: "EGRESO", SALDO_INICIAL: "APERTURA" };
  exigir(Object.hasOwn(tipos, b.categoria), "Categoría inválida");
  exigir(typeof b.monto === "number" && Number.isFinite(b.monto) && b.monto > 0 && b.monto <= 9999999999.99 &&
    Math.abs(b.monto * 100 - Math.round(b.monto * 100)) < 1e-6, "Monto inválido");
  exigir(fechaValida(b.fecha), "Fecha inválida");
  exigir(typeof b.concepto === "string" && b.concepto.trim().length > 0 && b.concepto.length <= 250, "Indica un concepto de hasta 250 caracteres");
  exigir(b.referencia == null || (typeof b.referencia === "string" && b.referencia.length <= 100), "Referencia inválida");
  exigir(b.categoria === "COMPRA" ? entero(b.idCompra) : b.idCompra == null, "Selecciona una compra para el pago a proveedor");
  return { clave: b.clave, categoria: b.categoria, tipo: tipos[b.categoria], metodo: b.metodo,
    monto: b.monto, fecha: b.fecha, concepto: b.concepto.trim(), referencia: b.referencia?.trim() || null, compra: b.idCompra ?? null };
}
// Cobros reales, incluidos abonos. Los puntos nunca representan una entrada de dinero.
const movimientos = `SELECT 'PAGO-' || g.id_pago id,'INGRESO' tipo,'VENTA' categoria,g.metodo,g.monto,
 CAST(g.fecha AS DATE) fecha,'Cobro venta #' || g.id_venta concepto,g.referencia,NULL::bigint id_manual
 FROM pagos g WHERE g.metodo<>'PUNTOS'
 UNION ALL SELECT 'MANUAL-' || m.id_movimiento,m.tipo,m.categoria,m.metodo,m.monto,m.fecha,m.concepto,m.referencia,m.id_movimiento
 FROM movimientos_financieros m WHERE m.anulado_en IS NULL`;
module.exports = { rango, validarMovimiento, movimientos };
