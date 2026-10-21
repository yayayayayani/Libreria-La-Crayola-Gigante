const { exigir } = require("./validaciones");
const centavos = (n) => Math.round(Number(n) * 100);
function resumenRecuperaciones(detalles, registros) {
  const rechazado = detalles.reduce((n, d) => n + Number(d.CANTIDAD_DANADA || 0) * centavos(d.COSTO), 0);
  const suma = (tipo) => registros.filter((r) => r.TIPO === tipo).reduce((n, r) => n + centavos(r.MONTO), 0);
  const credito = suma("NOTA_CREDITO"), reembolso = suma("REEMBOLSO"), perdida = suma("PERDIDA");
  return { rechazado: rechazado / 100, acreditado: credito / 100, reembolsado: reembolso / 100,
    perdida: perdida / 100, pendiente: (rechazado - credito - reembolso - perdida) / 100 };
}
function validarRecuperacion(d) {
  exigir(["NOTA_CREDITO", "REEMBOLSO", "PERDIDA"].includes(d.tipo), "Selecciona un tipo de resolución");
  exigir(typeof d.monto === "number" && Number.isFinite(d.monto) && d.monto > 0 &&
    d.monto <= 9999999999.99 && /^\d+(\.\d{1,2})?$/.test(String(d.monto)),
  "El monto debe ser positivo y tener máximo dos decimales");
  exigir(typeof d.referencia === "string" && d.referencia.trim().length > 0 && d.referencia.trim().length <= 100,
    "Indica el número de nota, comprobante o referencia de autorización (máximo 100 caracteres)");
  exigir(typeof d.fechaDocumento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.fechaDocumento) &&
    Number.isFinite(Date.parse(d.fechaDocumento)) &&
    new Date(d.fechaDocumento).toISOString().slice(0, 10) === d.fechaDocumento, "Fecha del documento inválida");
  const observaciones = d.observaciones ?? "";
  exigir(typeof observaciones === "string" && observaciones.length <= 500, "Observaciones: máximo 500 caracteres");
  exigir(d.tipo !== "PERDIDA" || observaciones.trim().length > 0, "Explica por qué el monto se reconoce como pérdida");
  exigir(typeof d.clave === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(d.clave), "Clave de operación inválida");
  return { tipo: d.tipo, monto: d.monto, referencia: d.referencia.trim().toUpperCase(),
    fechaDocumento: d.fechaDocumento, observaciones: observaciones.trim() || null, clave: d.clave };
}
module.exports = { resumenRecuperaciones, validarRecuperacion, centavos };
