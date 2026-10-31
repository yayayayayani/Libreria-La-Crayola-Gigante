const router = require("express").Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const { verificarPermiso } = require("../middlewares/permisosMiddleware");
const { conectar, filas } = require("../services/db");
const { rango } = require("../services/finanzas");
const { exigir, entero } = require("../services/validaciones");
router.use(verificarToken);
const endpoint = fn => async (req, res, next) => {
  let c;
  try {
    c = await conectar();
    await c.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    res.set("Cache-Control", "no-store");
    await fn(req, res, c);
  } catch (e) { next(e); }
  finally { if (c) await c.close(); }
};
function fechas(q) {
  const f = rango(q);
  exigir((Date.parse(f.hasta) - Date.parse(f.desde)) / 86400000 <= 366, "Selecciona un período de hasta 367 días");
  return f;
}
const periodo = "p.fecha>=CAST(:desde AS DATE) AND p.fecha<CAST(:hasta AS DATE)+INTERVAL '1 day'";
router.get("/dashboard/resumen", verificarPermiso("REPORTES_VER"), endpoint(async (req, res, c) => {
  const f = fechas(req.query);
  const [indicadores] = await filas(c, `SELECT COUNT(*) ventas,COALESCE(SUM(p.total),0) total,
    COALESCE(AVG(p.total),0) ticket_promedio FROM pedidos p WHERE p.estado='PAGADO' AND ${periodo}`, f);
  const ventasPorDia = await filas(c, `SELECT TO_CHAR(p.fecha,'YYYY-MM-DD') dia,COUNT(*) ventas,SUM(p.total) total
    FROM pedidos p WHERE p.estado='PAGADO' AND ${periodo} GROUP BY TO_CHAR(p.fecha,'YYYY-MM-DD') ORDER BY dia`, f);
  const productos = await filas(c, `SELECT pr.codigo,pr.nombre,SUM(d.cantidad) unidades
    FROM pedidos p JOIN detalle_pedidos d ON d.id_pedido=p.id_pedido JOIN productos pr ON pr.id_producto=d.id_producto
    WHERE p.estado='PAGADO' AND ${periodo} GROUP BY pr.id_producto,pr.codigo,pr.nombre ORDER BY unidades DESC,pr.codigo LIMIT 10`, f);
  const existencias = await filas(c, `SELECT id_producto,codigo,nombre,stock,stock_minimo FROM productos
    WHERE estado='A' AND (stock<stock_minimo OR stock=0) ORDER BY stock,nombre`);
  const [operacion] = await filas(c, `SELECT
    (SELECT COUNT(*) FROM productos WHERE estado='A') productos_activos,
    (SELECT COUNT(*) FROM clientes WHERE estado='A') clientes_activos,
    (SELECT COUNT(*) FROM pedidos WHERE estado='PENDIENTE_APROBACION') pedidos_pendientes,
    (SELECT COUNT(*) FROM pedidos WHERE estado='VENDIDO') ventas_pendientes`);
  res.json({ periodo: f, indicadores, ventasPorDia, productos, existencias, operacion });
}));
router.get("/reportes/sprint4/:tipo", verificarPermiso("REPORTES_VER"), endpoint(async (req, res, c) => {
  exigir(["inventario", "compras"].includes(req.params.tipo), "Reporte inexistente", 404);
  const f = fechas(req.query);
  const sql = req.params.tipo === "inventario"
    ? `SELECT p.codigo,p.nombre,c.nombre categoria,p.estado,p.stock,p.stock_minimo,p.precio,
       CASE WHEN p.estado='A' AND (p.stock<p.stock_minimo OR p.stock=0) THEN 'REABASTECER' ELSE 'NORMAL' END alerta
       FROM productos p JOIN categorias c ON c.id_categoria=p.id_categoria ORDER BY p.nombre`
    : `SELECT p.id_compra,TO_CHAR(p.fecha,'YYYY-MM-DD') fecha,v.nombre proveedor,p.factura,p.total,
       p.total-COALESCE((SELECT SUM(m.monto) FROM movimientos_financieros m WHERE m.id_compra=p.id_compra AND m.anulado_en IS NULL),0) pendiente
       FROM compras p JOIN proveedores v ON v.id_proveedor=p.id_proveedor WHERE ${periodo} ORDER BY p.fecha DESC,p.id_compra DESC`;
  res.json(await filas(c, sql, req.params.tipo === "inventario" ? {} : f));
}));
router.get("/auditoria", verificarPermiso("BITACORA_VER"), endpoint(async (req, res, c) => {
  const f = fechas(req.query), pagina = Number(req.query.pagina || 1);
  exigir(entero(pagina, 1, 100000), "Página inválida");
  const texto = (nombre, max) => {
    const valor = req.query[nombre] ?? "";
    exigir(typeof valor === "string" && valor.length <= max, `Filtro ${nombre} inválido`);
    return valor.trim();
  };
  const tabla = texto("tabla", 50), accion = texto("accion", 80), buscar = texto("buscar", 150), usuario = texto("usuario", 100);
  exigir(/^[A-Z_]*$/.test(tabla), "Tabla inválida");
  exigir(/^[A-Z_]*$/.test(accion), "Acción inválida");
  const registroTexto = texto("registro", 16), registro = registroTexto ? Number(registroTexto) : null;
  exigir(registro === null || entero(registro), "Número de registro inválido");
  const base = `b.fecha_hora>=CAST(:desde AS DATE) AND b.fecha_hora<CAST(:hasta AS DATE)+INTERVAL '1 day' ${tabla ? "AND b.tabla_afectada=:tabla" : ""}`;
  const baseBinds = { ...f, ...(tabla ? { tabla } : {}) };
  const condiciones = [base], binds = { ...baseBinds };
  if (accion) { condiciones.push("b.accion=:accion"); binds.accion=accion; }
  if (registro !== null) { condiciones.push("b.id_registro_afectado=:registro"); binds.registro=registro; }
  if (buscar) { condiciones.push("POSITION(LOWER(:buscar) IN LOWER(COALESCE(b.detalle,'') || ' ' || b.accion))>0"); binds.buscar=buscar; }
  if (usuario) { condiciones.push("POSITION(LOWER(:usuario) IN LOWER(COALESCE(u.nombre_usuario,'') || ' ' || COALESCE(u.nombre_completo,'')))>0"); binds.usuario=usuario; }
  const where=condiciones.join(" AND "), origen="FROM bitacora b LEFT JOIN usuarios u ON u.id_usuario=b.id_usuario";
  const [cuenta] = await filas(c, `SELECT COUNT(*) total ${origen} WHERE ${where}`, binds);
  const registros = await filas(c, `SELECT b.*,u.nombre_usuario actor,u.nombre_completo actor_nombre ${origen}
    WHERE ${where} ORDER BY b.id_bitacora DESC LIMIT 50 OFFSET :offset`, { ...binds, offset: (pagina-1)*50 });
  const acciones = await filas(c, `SELECT DISTINCT b.accion FROM bitacora b WHERE ${base} ORDER BY b.accion`, baseBinds);
  res.json({ registros, total: cuenta.TOTAL, pagina, acciones: acciones.map(a => a.ACCION) });
}));
module.exports = router;
