export const tipoDocumento = (valor) => (/^[0-9]{13}$/.test(valor || "") ? "DPI" : "NIT");
export function formatearDocumento(valor, tipo = tipoDocumento(valor)) {
  const texto = String(valor || "")
    .trim()
    .toUpperCase();
  if (tipo !== "NIT" || texto === "CF") return texto;
  const nit = texto.replace(/-/g, "");
  return nit.length > 1 ? `${nit.slice(0, -1)}-${nit.slice(-1)}` : nit;
}
