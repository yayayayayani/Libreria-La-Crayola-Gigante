const importes = /^(PRECIO|COSTO|TOTAL|SUBTOTAL|MONTO|PAGADO|PENDIENTE_PAGO|PENDIENTE_RECUPERAR|DESCUENTOS|BASE_IMPONIBLE|IVA|CANJE_PUNTOS|INGRESOS|EGRESOS|BALANCE|SALDO|IMPORTE_BRUTO)$/;
const etiquetas = { DIA: 'Fecha', CODIGO: 'Código', TELEFONO: 'Teléfono', DIRECCION: 'Dirección', METODO: 'Método', NIT: 'NIT / DPI', STOCK: 'Existencias', STOCK_MINIMO: 'Existencia mínima', IVA: 'IVA', BASE_IMPONIBLE: 'Base sin IVA', CANJE_PUNTOS: 'Canje de puntos', IMPORTE_BRUTO: 'Importe bruto antes de descuentos' };
export function encabezadoCsv(campo) {
  const nombre = etiquetas[campo] || campo.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
  return nombre + (importes.test(campo) ? ' (Q)' : '');
}
function formato(valor, campo) {
  if (valor == null) return '';
  if (importes.test(campo) && valor !== '' && Number.isFinite(Number(valor))) return Number(valor).toFixed(2);
  if (campo === 'ALERTA') return Number(valor) ? 'Reponer' : 'Sin alerta';
  if (campo === 'DIA' && /^\d{4}-\d{2}-\d{2}/.test(String(valor))) return String(valor).slice(0, 10);
  if (/^(FECHA|DIA)$/.test(campo)) {
    const texto = String(valor);
    // Las fechas contables no deben cambiar de día por la zona horaria.
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
    const fecha = new Date(valor);
    if (!Number.isNaN(fecha.getTime())) return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(fecha);
  }
  if (campo === 'ESTADO') return ({ A: 'Activo', I: 'Inactivo', PENDIENTE_APROBACION: 'Por aprobar', VENDIDO: 'Pendiente de pago' })[valor] || String(valor).toLowerCase().replaceAll('_', ' ');
  return valor;
}
export function contenidoCsv(filas, columnas) {
  const campos = columnas || [...new Set(filas.flatMap(Object.keys))];
  const celda = valor => {
    let texto = valor == null ? '' : String(valor);
    // Evita interpretar datos ingresados por usuarios como fórmulas de Excel.
    if (typeof valor === 'string' && /^[\s]*[=+@-]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replaceAll('"','""') + '"';
  };
  return '\uFEFF' + [campos.map(c => celda(encabezadoCsv(c))).join(','), ...filas.map(f=>campos.map(c=>celda(formato(f[c], c))).join(','))].join('\r\n');
}
export function descargarCsv(filas, nombre, columnas) {
  const url = URL.createObjectURL(new Blob([contenidoCsv(filas, columnas)], {type:'text/csv;charset=utf-8'}));
  const fecha = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Guatemala' }).format(new Date());
  const a = document.createElement('a');a.href=url;a.download=`${nombre.replace(/\.csv$/i, '')}-${fecha}.csv`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
