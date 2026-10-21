const { filas } = require("./db");
const { exigir } = require("./validaciones");
async function comprobante(c, idPedido) {
  const [venta] = await filas(c, `SELECT v.*,p.subtotal,p.descuento,p.estado
    FROM ventas v JOIN pedidos p ON p.id_pedido=v.id_pedido WHERE p.id_pedido=:id`, { id: idPedido });
  exigir(venta?.ESTADO === "PAGADO", "El comprobante se emite al completar el pago", 409);
  const [existente] = await filas(c, "SELECT contenido FROM comprobantes WHERE id_venta=:id", { id: venta.ID_VENTA });
  if (existente) return JSON.parse(existente.CONTENIDO);
  const detalles = await filas(c, `SELECT d.cantidad,d.precio,p.nombre,p.codigo FROM detalle_ventas d
    JOIN productos p ON p.id_producto=d.id_producto WHERE d.id_venta=:id ORDER BY d.id_detalle`, { id: venta.ID_VENTA });
  const pagos = await filas(c, "SELECT monto,metodo,referencia,recibido,fecha FROM pagos WHERE id_venta=:id ORDER BY id_pago", { id: venta.ID_VENTA });
  const contenido = {
    numero: `CV-${String(venta.ID_VENTA).padStart(8, "0")}`,
    negocio: "Librería La Crayola Gigante",
    fecha: pagos.at(-1)?.FECHA || venta.FECHA,
    venta, detalles, pagos,
  };
  await c.execute("INSERT INTO comprobantes(id_venta,contenido) VALUES (:id,:contenido) ON CONFLICT(id_venta) DO NOTHING",
    { id: venta.ID_VENTA, contenido: JSON.stringify(contenido) });
  const [guardado] = await filas(c, "SELECT contenido FROM comprobantes WHERE id_venta=:id", { id: venta.ID_VENTA });
  return JSON.parse(guardado.CONTENIDO);
}
module.exports = { comprobante };
