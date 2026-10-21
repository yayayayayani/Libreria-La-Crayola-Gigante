const router = require("express").Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const { soloAdministrador } = require("../services/acceso");
const { conectar, filas, idSalida } = require("../services/db");
const { exigir, entero } = require("../services/validaciones");
const { rango, validarMovimiento, movimientos } = require("../services/finanzas");
router.use(verificarToken, soloAdministrador);
const endpoint = (fn) => async (req, res) => {
  let c;
  try { c = await conectar(); res.set("Cache-Control", "no-store"); await fn(req, res, c); }
  catch (e) {
    if (c) await c.rollback();
    res.status(e.status || (e.errorNum === 1 ? 409 : 500)).json({ mensaje: e.status ? e.message : "No se pudo completar la operación financiera" });
  } finally { if (c) await c.close(); }
};
const auditar = (c, req, accion, id, detalle) => c.execute(
  "INSERT INTO bitacora(id_usuario,accion,tabla_afectada,id_registro_afectado,detalle) VALUES (:usuario,:accion,'FINANZAS',:id,:detalle)",
  { usuario: req.usuario.ID_USUARIO, accion, id, detalle });
router.get("/resumen", endpoint(async (req, res, c) => {
  const fechas = rango(req.query);
  const pagina = Number(req.query.pagina || 1);
  exigir(entero(pagina, 1, 100000), "Página inválida");
  await c.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  const porMetodo = await filas(c, `WITH m AS (${movimientos})
    SELECT metodo,
    COALESCE(SUM(CASE WHEN fecha BETWEEN CAST(:desde AS DATE) AND CAST(:hasta AS DATE) AND tipo='INGRESO' THEN monto ELSE 0 END),0) ingresos,
    COALESCE(SUM(CASE WHEN fecha BETWEEN CAST(:desde AS DATE) AND CAST(:hasta AS DATE) AND tipo='EGRESO' THEN monto ELSE 0 END),0) egresos,
    COALESCE(SUM(CASE WHEN fecha<CAST(:desde AS DATE) THEN CASE WHEN tipo='EGRESO' THEN -monto ELSE monto END ELSE 0 END),0) saldo_anterior,
    COALESCE(SUM(CASE WHEN fecha BETWEEN CAST(:desde AS DATE) AND CAST(:hasta AS DATE) AND tipo='APERTURA' THEN monto ELSE 0 END),0) aperturas,
    COALESCE(SUM(CASE WHEN tipo='EGRESO' THEN -monto ELSE monto END),0) saldo
    FROM m WHERE fecha<=CAST(:hasta AS DATE) GROUP BY metodo ORDER BY metodo`, fechas);
  const [cuenta] = await filas(c, `WITH m AS (${movimientos}) SELECT COUNT(*) total FROM m
    WHERE fecha BETWEEN CAST(:desde AS DATE) AND CAST(:hasta AS DATE)`, fechas);
  const detalle = await filas(c, `WITH m AS (${movimientos}) SELECT * FROM m
    WHERE fecha BETWEEN CAST(:desde AS DATE) AND CAST(:hasta AS DATE) ORDER BY fecha DESC,id DESC LIMIT 50 OFFSET :offset`,
    { ...fechas, offset: (pagina - 1) * 50 });
  const porDia = await filas(c, `WITH m AS (${movimientos}) SELECT fecha,
    SUM(CASE WHEN tipo='INGRESO' THEN monto ELSE 0 END) ingresos,
    SUM(CASE WHEN tipo='EGRESO' THEN monto ELSE 0 END) egresos
    FROM m WHERE fecha BETWEEN CAST(:desde AS DATE) AND CAST(:hasta AS DATE) GROUP BY fecha ORDER BY fecha`, fechas);
  const totales = Object.fromEntries(["INGRESOS", "EGRESOS", "SALDO_ANTERIOR", "APERTURAS", "SALDO"]
    .map(k => [k, porMetodo.reduce((n, r) => n + Math.round(r[k] * 100), 0) / 100]));
  totales.BALANCE = (Math.round(totales.INGRESOS * 100) - Math.round(totales.EGRESOS * 100)) / 100;
  res.json({ totales, porMetodo, porDia, movimientos: detalle, totalMovimientos: cuenta.TOTAL, pagina });
}));
router.get("/exportar", endpoint(async (req, res, c) => {
  const fechas=rango(req.query);
  res.json(await filas(c,`WITH m AS (${movimientos}) SELECT * FROM m WHERE fecha BETWEEN CAST(:desde AS DATE) AND CAST(:hasta AS DATE) ORDER BY fecha DESC,id DESC`,fechas));
}));
router.get("/compras-pendientes", endpoint(async (req, res, c) => {
  res.json(await filas(c, `SELECT c.id_compra,c.factura,p.nombre proveedor,c.total,
    c.total-COALESCE(SUM(m.monto),0) pendiente
    FROM compras c JOIN proveedores p ON p.id_proveedor=c.id_proveedor
    LEFT JOIN movimientos_financieros m ON m.id_compra=c.id_compra AND m.anulado_en IS NULL
    GROUP BY c.id_compra,c.factura,p.nombre,c.total HAVING c.total>COALESCE(SUM(m.monto),0)
    ORDER BY c.id_compra DESC`));
}));
router.post("/movimientos", endpoint(async (req, res, c) => {
  const b = validarMovimiento(req.body || {});
  await c.execute("SELECT pg_advisory_xact_lock(hashtext(:clave))", { clave: `finanzas-${b.clave}` });
  const [prev] = await filas(c, "SELECT m.*,TO_CHAR(m.fecha,'YYYY-MM-DD') fecha FROM movimientos_financieros m WHERE clave=:clave", { clave: b.clave });
  if (prev) {
    exigir(prev.ID_USUARIO === req.usuario.ID_USUARIO && prev.MONTO === b.monto && prev.METODO === b.metodo &&
      prev.CATEGORIA === b.categoria && prev.FECHA === b.fecha && prev.CONCEPTO === b.concepto &&
      prev.REFERENCIA === b.referencia && prev.ID_COMPRA === b.compra, "La clave corresponde a otro movimiento", 409);
    return res.json({ mensaje: "Movimiento ya registrado", id: prev.ID_MOVIMIENTO });
  }
  const [hoy] = await filas(c, "SELECT TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') hoy");
  exigir(b.fecha <= hoy.HOY, "No registres movimientos con fecha futura");
  await c.execute("SELECT pg_advisory_xact_lock(hashtext(:clave))", { clave: `apertura-${b.metodo}` });
  if (b.tipo === "APERTURA") {
    const [primero] = await filas(c, `WITH m AS (${movimientos}) SELECT TO_CHAR(MIN(fecha),'YYYY-MM-DD') primera FROM m WHERE metodo=:metodo`, { metodo: b.metodo });
    exigir(!primero.PRIMERA || b.fecha <= primero.PRIMERA, "El saldo inicial debe corresponder al inicio del historial de este método", 409);
    exigir(!(await filas(c, "SELECT id_movimiento FROM movimientos_financieros WHERE tipo='APERTURA' AND metodo=:metodo AND anulado_en IS NULL", { metodo: b.metodo })).length, "Ya existe un saldo inicial para este método", 409);
  } else {
    const [apertura] = await filas(c, "SELECT TO_CHAR(fecha,'YYYY-MM-DD') fecha FROM movimientos_financieros WHERE tipo='APERTURA' AND metodo=:metodo AND anulado_en IS NULL", { metodo: b.metodo });
    exigir(!apertura || b.fecha >= apertura.FECHA, "La fecha no puede ser anterior al saldo inicial", 409);
  }
  if (b.compra) {
    const [compra] = await filas(c, "SELECT total FROM compras WHERE id_compra=:id FOR UPDATE", { id: b.compra });
    exigir(compra, "Compra inexistente", 404);
    const [pagos] = await filas(c, "SELECT COALESCE(SUM(monto),0) pagado FROM movimientos_financieros WHERE id_compra=:id AND anulado_en IS NULL", { id: b.compra });
    exigir(Math.round(pagos.PAGADO * 100) + Math.round(b.monto * 100) <= Math.round(compra.TOTAL * 100), "El pago excede el pendiente de la compra", 409);
  }
  const r = await c.execute(`INSERT INTO movimientos_financieros(id_usuario,id_compra,clave,tipo,categoria,metodo,monto,fecha,concepto,referencia)
    VALUES (:usuario,:compra,:clave,:tipo,:categoria,:metodo,:monto,CAST(:fecha AS DATE),:concepto,:referencia) RETURNING id_movimiento INTO :id`,
    { ...b, usuario: req.usuario.ID_USUARIO, id: idSalida() });
  const id = r.outBinds.id[0];
  await auditar(c, req, "MOVIMIENTO_REGISTRADO", id, JSON.stringify(b));
  await c.commit();
  res.status(201).json({ mensaje: "Movimiento registrado", id });
}));
router.post("/movimientos/:id/anular", endpoint(async (req, res, c) => {
  const id = Number(req.params.id), motivo = req.body?.motivo;
  exigir(entero(id) && typeof motivo === "string" && motivo.trim().length > 0 && motivo.length <= 250, "Identificador y motivo obligatorios");
  const [m] = await filas(c, "SELECT * FROM movimientos_financieros WHERE id_movimiento=:id FOR UPDATE", { id });
  exigir(m, "Movimiento inexistente", 404);
  if (!m.ANULADO_EN) {
    if (m.ID_COMPRA) await filas(c, "SELECT id_compra FROM compras WHERE id_compra=:id FOR UPDATE", { id: m.ID_COMPRA });
    await c.execute("UPDATE movimientos_financieros SET anulado_en=LOCALTIMESTAMP,motivo_anulacion=:motivo WHERE id_movimiento=:id", { id, motivo: motivo.trim() });
    await auditar(c, req, "MOVIMIENTO_ANULADO", id, motivo.trim());
    await c.commit();
  }
  res.json({ mensaje: "Movimiento anulado; el historial de auditoría se conserva" });
}));
module.exports = router;
