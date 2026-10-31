export const quetzales = n => `Q ${Number(n || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fechaReporte = v => { const s = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("/") : (s || "—"); };
const col = (clave, titulo, tipo = "texto") => ({ clave, titulo, tipo });
export const reportesVista = {
  inventario: {
    titulo: "Inventario actual", descripcion: "Productos, existencias y niveles mínimos al momento de consultar. Las fechas del dashboard no cambian este reporte.",
    ayuda: "Existencias y mínimo son unidades. Precio unitario es el precio de venta en quetzales, no el costo ni el valor total del inventario. Reabastecer identifica productos activos agotados o bajo su mínimo.",
    monto: "PRECIO", montoNombre: "Precio unitario", cantidad: "STOCK", cantidadNombre: "Existencias", grupo: "CATEGORIA", grupoNombre: "Categoría",
    columnas: [col("CODIGO", "Código"), col("NOMBRE", "Producto"), col("CATEGORIA", "Categoría"), col("ESTADO", "Estado", "estado"), col("STOCK", "Existencias (unidades)", "numero"), col("STOCK_MINIMO", "Mínimo (unidades)", "numero"), col("PRECIO", "Precio unitario (Q)", "moneda"), col("ALERTA", "Alerta", "alerta")],
  },
  compras: {
    titulo: "Compras del período", descripcion: "Compras registradas en las fechas elegidas. Permite identificar el proveedor, documento y saldo de cada compra.",
    ayuda: "Total es el importe de la compra. Pendiente de pago es lo que falta pagar al proveedor al momento de consultar. Q 0.00 indica que no hay saldo pendiente. Todos los importes están en quetzales.",
    monto: "TOTAL", montoNombre: "Total de compra", grupo: "PROVEEDOR", grupoNombre: "Proveedor",
    columnas: [col("ID_COMPRA", "Compra n.º", "numero"), col("FECHA", "Fecha", "fecha"), col("PROVEEDOR", "Proveedor"), col("FACTURA", "Documento / factura"), col("TOTAL", "Total (Q)", "moneda"), col("PENDIENTE", "Pendiente de pago (Q)", "moneda")],
  },
  productos: {
    titulo: "Productos vendidos del período", descripcion: "Productos de pedidos pagados, agrupados por código. Las fechas corresponden al pedido.",
    ayuda: "Unidades es la cantidad vendida. Importe bruto es unidades por precio antes de descuentos; no es ganancia ni efectivo recibido. Sus importes se expresan en quetzales.",
    monto: "IMPORTE_BRUTO", montoNombre: "Importe bruto", cantidad: "UNIDADES", cantidadNombre: "Unidades vendidas",
    columnas: [col("CODIGO", "Código"), col("NOMBRE", "Producto"), col("UNIDADES", "Unidades vendidas", "numero"), col("IMPORTE_BRUTO", "Importe bruto (Q)", "moneda")],
  },
  ventas: {
    titulo: "Ventas del período", descripcion: "Resumen diario de pedidos pagados, según la fecha del pedido. Los días sin ventas no tienen fila.",
    ayuda: "Subtotal es el importe antes de descuentos; total es el importe final con IVA incluido. Base imponible e IVA desglosan ese total. Canje de puntos es el valor pagado con puntos e ingresos corresponde al dinero cobrado por esos pedidos. No equivale al flujo de caja por fecha de cobro.",
    monto: "TOTAL", montoNombre: "Total del día", cantidad: "VENTAS", cantidadNombre: "Ventas por día",
    columnas: [col("DIA", "Fecha", "fecha"), col("VENTAS", "Ventas pagadas", "numero"), col("SUBTOTAL", "Subtotal (Q)", "moneda"), col("DESCUENTOS", "Descuentos (Q)", "moneda"), col("TOTAL", "Total vendido (Q)", "moneda"), col("BASE_IMPONIBLE", "Base imponible (Q)", "moneda"), col("IVA", "IVA incluido (Q)", "moneda"), col("CANJE_PUNTOS", "Canje de puntos (Q)", "moneda"), col("INGRESOS", "Dinero cobrado (Q)", "moneda")],
  },
};
export const filtrosReporteIniciales = { buscar: "", grupo: "", estado: "", minimo: "", maximo: "", cantidad: "", orden: "original" };
const normalizar = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filtrarReporte(filas, tipo, f) {
  const cfg = reportesVista[tipo], texto = normalizar(f.buscar.trim());
  const resultado = filas.filter(r => {
    if (texto && !cfg.columnas.some(c => normalizar(r[c.clave]).includes(texto))) return false;
    if (f.grupo && r[cfg.grupo] !== f.grupo) return false;
    if (tipo === "compras" && f.estado && (f.estado === "pendiente" ? Number(r.PENDIENTE) <= 0 : Number(r.PENDIENTE) > 0)) return false;
    if (tipo === "inventario" && f.estado && (f.estado === "reabastecer" ? r.ALERTA !== "REABASTECER" : r.ESTADO !== f.estado)) return false;
    if (f.minimo !== "" && Number(r[cfg.monto]) < Number(f.minimo)) return false;
    if (f.maximo !== "" && Number(r[cfg.monto]) > Number(f.maximo)) return false;
    if (cfg.cantidad && f.cantidad !== "" && Number(r[cfg.cantidad]) < Number(f.cantidad)) return false;
    return true;
  });
  if (f.orden === "monto-desc") resultado.sort((a,b) => Number(b[cfg.monto]) - Number(a[cfg.monto]));
  if (f.orden === "monto-asc") resultado.sort((a,b) => Number(a[cfg.monto]) - Number(b[cfg.monto]));
  if (f.orden === "cantidad-desc") resultado.sort((a,b) => Number(b[cfg.cantidad]) - Number(a[cfg.cantidad]));
  if (f.orden === "nombre") resultado.sort((a,b) => String(a.NOMBRE || a.PROVEEDOR || "").localeCompare(String(b.NOMBRE || b.PROVEEDOR || ""), "es"));
  return resultado;
}
export function valorReporte(valor, tipo) {
  if (valor == null) return "—";
  if (tipo === "moneda") return quetzales(valor);
  if (tipo === "numero") return Number(valor).toLocaleString("es-GT");
  if (tipo === "fecha") return fechaReporte(valor);
  if (tipo === "estado") return ({ A: "Activo", I: "Inactivo" })[valor] || valor;
  if (tipo === "alerta") return ({ NORMAL: "Sin alerta", REABASTECER: "Reabastecer" })[valor] || valor;
  return String(valor);
}
export function exportarFilasReporte(filas, tipo) {
  return filas.map(r => Object.fromEntries(reportesVista[tipo].columnas.map(c => [c.titulo,
    r[c.clave] == null ? "" : c.tipo === "moneda" ? Number(r[c.clave]).toFixed(2) : c.tipo === "numero" ? Number(r[c.clave]) : valorReporte(r[c.clave], c.tipo),
  ])));
}
