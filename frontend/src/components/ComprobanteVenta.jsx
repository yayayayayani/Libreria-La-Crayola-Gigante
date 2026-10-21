import { useRef } from "react";
const escapar = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const q = (n) => `Q${Number(n || 0).toFixed(2)}`;
function htmlComprobante(d) {
  const v = d.venta;
  const copia = (nombre) => `<section>
    <header><h1>${escapar(d.negocio)}</h1><h2>Comprobante de venta ${escapar(d.numero)}</h2><strong>Copia para ${nombre}</strong></header>
    <p>${escapar(new Date(d.fecha).toLocaleString("es-GT", { timeZone: "America/Guatemala" }))}<br>
    Cliente: ${escapar(v.CLIENTE_NOMBRE)}<br>NIT / documento: ${escapar(v.DOCUMENTO || "CF")}</p>
    <table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio con IVA</th><th>Importe</th></tr></thead><tbody>
    ${d.detalles.map((l) => `<tr><td>${escapar(l.NOMBRE)}<small>${escapar(l.CODIGO)}</small></td><td>${l.CANTIDAD}</td><td>${q(l.PRECIO)}</td><td>${q(Math.round(l.PRECIO * 100) * l.CANTIDAD / 100)}</td></tr>`).join("")}
    </tbody></table>
    <dl><div><dt>Productos (IVA incluido)</dt><dd>${q(v.SUBTOTAL)}</dd></div>
    <div><dt>Descuento (${Number(v.DESCUENTO)} %)</dt><dd>${q(v.SUBTOTAL - v.TOTAL)}</dd></div>
    <div><dt>Base sin IVA</dt><dd>${q(v.BASE_IMPONIBLE)}</dd></div>
    <div><dt>IVA incluido (${Number(v.IVA_TASA)} %)</dt><dd>${q(v.IVA)}</dd></div>
    <div class="total"><dt>Total pagado</dt><dd>${q(v.TOTAL)}</dd></div></dl>
    <h3>Forma de pago</h3>
    ${d.pagos.map((p) => `<p>${escapar(p.METODO)}: <strong>${q(p.MONTO)}</strong>${p.REFERENCIA ? ` · Referencia: ${escapar(p.REFERENCIA)}` : ""}${p.RECIBIDO != null ? `<br>Recibido: ${q(p.RECIBIDO)} · Cambio: ${q(p.RECIBIDO - p.MONTO)}` : ""}</p>`).join("")}
    <footer>Documento informativo de venta. No es una factura FEL autorizada.<br>Gracias por tu compra.</footer>
    </section>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(d.numero)}</title><style>
    @page { size: A4; margin: 16mm; } * { box-sizing:border-box; } body { margin:0; font:14px Arial,sans-serif; color:#182b23; background:#eee; }
    section { background:white; max-width:800px; margin:16px auto; padding:30px; } header { border-bottom:2px solid #365c46; padding-bottom:18px; }
    h1 { font-size:24px; } h2 { font-size:17px; } h3 { font-size:15px; } p { line-height:1.6; overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; } th,td { text-align:right; padding:10px 5px; border-bottom:1px solid #ddd; overflow-wrap:anywhere; }
    th:first-child,td:first-child { text-align:left; width:45%; } thead { display:table-header-group; } tr { break-inside:avoid; } small { display:block; color:#666; }
    dl { margin-left:auto; max-width:350px; } dl div { display:flex; justify-content:space-between; padding:8px 0; gap:12px; } dd { margin:0; white-space:nowrap; }
    .total { font-size:19px; font-weight:bold; border-top:2px solid #365c46; } footer { margin-top:30px; font-size:12px; color:#555; }
    @media print { body { background:white; } section { margin:0; padding:0; max-width:none; break-after:page; } section:last-child { break-after:auto; } }
    </style></head><body>${copia("el negocio")}${copia("el cliente")}</body></html>`;
}
export default function ComprobanteVenta({ documento, automatico, onCerrar }) {
  const marco = useRef(null), impreso = useRef(false);
  const imprimir = () => {
    marco.current?.contentWindow?.focus();
    marco.current?.contentWindow?.print();
  };
  return <section className="comprobante-modal" role="dialog" aria-modal="true" aria-label="Comprobante de venta">
    <header><div><h3>{documento.numero} · Comprobante de venta</h3><p>Dos copias: negocio y cliente. Para descargar el PDF, elige “Guardar como PDF” al imprimir.</p></div>
      <button onClick={imprimir}>Imprimir / Guardar PDF</button><button onClick={onCerrar}>Cerrar comprobante</button></header>
    <iframe ref={marco} title="Copias del comprobante" srcDoc={htmlComprobante(documento)} onLoad={() => {
      if (automatico && !impreso.current) { impreso.current = true; imprimir(); }
    }} />
  </section>;
}
