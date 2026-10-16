const nombreValido = v => typeof v === 'string' && /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(v.trim());
const correoValido = v => typeof v === 'string' && v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const nitValido = v => typeof v === 'string' && /^(?:[1-9][0-9]{0,10}-?[0-9K]|[0-9]{13})$/.test(v);
function exigir(condicion, mensaje, status = 400) {
  if (!condicion) { const error = new Error(mensaje); error.status = status; throw error; }
}
const entero = (v, min = 1, max = 9999999999) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
function validarCompra(datos) {
  exigir(datos && typeof datos === 'object' && !Array.isArray(datos), 'La compra debe ser un objeto válido');
  exigir(entero(datos.idProveedor), 'Selecciona un proveedor válido');
  exigir(typeof datos.factura === 'string' && datos.factura.trim().length > 0 && datos.factura.trim().length <= 80, 'La factura es obligatoria (máximo 80 caracteres)');
  exigir(typeof datos.clave === 'string' && /^[a-zA-Z0-9-]{16,64}$/.test(datos.clave), 'La clave de operación es obligatoria');
  exigir(Array.isArray(datos.detalles) && datos.detalles.length > 0 && datos.detalles.length <= 100, 'La compra requiere entre 1 y 100 productos');
  const ids = new Set(); let totalCentavos = 0;
  const detalles = datos.detalles.map(d => {
    exigir(d && typeof d === 'object' && !Array.isArray(d), 'Cada detalle debe ser un objeto válido');
    exigir(entero(d.idProducto) && !ids.has(d.idProducto), 'Producto inválido o repetido'); ids.add(d.idProducto);
    exigir(entero(d.cantidad, 1, 1000000), 'La cantidad debe ser un entero positivo (máximo 1000000)');
    exigir(typeof d.costo === 'number' && Number.isFinite(d.costo) && d.costo > 0 && d.costo <= 99999999.99 && /^\d+(\.\d{1,2})?$/.test(String(d.costo)), 'El costo debe ser positivo con máximo dos decimales');
    totalCentavos += Math.round(d.costo * 100) * d.cantidad;
    return { idProducto: d.idProducto, cantidad: d.cantidad, costo: d.costo };
  }).sort((a,b) => a.idProducto - b.idProducto);
  exigir(Number.isSafeInteger(totalCentavos) && totalCentavos <= 999999999999, 'El total supera el límite permitido');
  return { idProveedor: datos.idProveedor, factura: datos.factura.trim().toUpperCase(), clave: datos.clave, detalles, total: totalCentavos / 100 };
}
module.exports = { nombreValido, correoValido, nitValido, exigir, entero, validarCompra };
