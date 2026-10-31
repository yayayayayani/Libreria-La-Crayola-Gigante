export const dinero = n => Number(n || 0).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });
export const fechaCorta = iso => new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
export function serieDiaria(filas, desde, hasta, campo = "TOTAL") {
  if (!filas.length) return [];
  const porDia = new Map(filas.map(f => [f.DIA, f]));
  const salida = [], fin = Date.parse(`${hasta}T12:00:00Z`);
  for (let t = Date.parse(`${desde}T12:00:00Z`); t <= fin && salida.length < 367; t += 86400000) {
    const id = new Date(t).toISOString().slice(0, 10), fila = porDia.get(id);
    salida.push({ id, nombre: fechaCorta(id), detalle: id, valor: Number(fila?.[campo] || 0) });
  }
  return salida;
}
export function periodoRapido(tipo, hoy) {
  const t = new Date(`${hoy}T12:00:00Z`);
  if (tipo === "mes") return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
  t.setUTCDate(t.getUTCDate() - (tipo === "semana" ? 6 : 29));
  return { desde: t.toISOString().slice(0, 10), hasta: hoy };
}
