const router = require("express").Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const { verificarPermiso } = require("../middlewares/permisosMiddleware");
const { conectar, filas, idSalida } = require("../services/db");
const { exigir, entero, nitValido } = require("../services/validaciones");
const { validarPedido, calcular, validarPago } = require("../services/pedidos");
const { canje, ganar } = require("../services/puntos");
const { comprobante } = require("../services/comprobantes");
router.use(verificarToken);
const endpoint = (fn) => async (req, res) => {
  let c;
  try {
    c = await conectar();
    await fn(req, res, c);
  } catch (e) {
    if (c) await c.rollback();
    res.status(e.status || (e.errorNum === 1 ? 409 : 500)).json({
      mensaje: e.status ? e.message : e.errorNum === 1 ? "Operación duplicada; consulta el registro antes de reintentar." : "No se pudo completar la operación",
    });
  } finally { if (c) await c.close(); }
};
const permiso = (p) => verificarPermiso(p);
const auditar = (c, req, accion, id, detalle) => c.execute(
  "INSERT INTO bitacora(id_usuario,accion,tabla_afectada,id_registro_afectado,detalle) VALUES (:usuario,:accion,'PEDIDOS',:id,:detalle)",
  { usuario: req.usuario.ID_USUARIO, accion, id, detalle },
);
async function obtener(c, id, usuario) {
  exigir(entero(Number(id)), "Identificador inválido");
  const [p] = await filas(c, "SELECT * FROM pedidos WHERE id_pedido=:id FOR UPDATE", { id: Number(id) });
  exigir(p, "Pedido inexistente", 404);
  exigir([1, 3].includes(usuario.ID_ROL) || p.ID_USUARIO === usuario.ID_USUARIO, "Solo puedes consultar y gestionar tus propias ventas", 403);
  return p;
}
async function inventario(c, id) {
  const detalles = await filas(c, "SELECT * FROM detalle_pedidos WHERE id_pedido=:id ORDER BY id_producto", { id });
  for (const d of detalles) {
    const [p] = await filas(c, "SELECT stock,estado FROM productos WHERE id_producto=:id FOR UPDATE", { id: d.ID_PRODUCTO });
    exigir(p?.ESTADO === "A" && p.STOCK >= d.CANTIDAD, `Inventario insuficiente o producto inactivo: ${d.ID_PRODUCTO}`, 409);
    d.stock = p.STOCK;
  }
  return detalles;
}
function filtros(q) {
  const where = [], binds = {};
  if (q.estado) {
    exigir(["APROBADO", "PENDIENTE_APROBACION", "RECHAZADO", "CANCELADO", "VENDIDO", "PAGADO"].includes(q.estado), "Estado inválido");
    where.push("p.estado=:estado"); binds.estado = q.estado;
  }
  for (const campo of ["desde", "hasta"]) if (q[campo]) {
    exigir(typeof q[campo] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q[campo]) &&
      !isNaN(Date.parse(q[campo])) && new Date(q[campo]).toISOString().slice(0,10) === q[campo], "Fecha inválida");
    where.push(campo === "desde" ? "p.fecha>=CAST(:desde AS DATE)" : "p.fecha<CAST(:hasta AS DATE)+INTERVAL '1 day'");
    binds[campo] = q[campo];
  }
  exigir(!q.desde || !q.hasta || q.desde <= q.hasta, "Rango de fechas inválido");
  if (q.cliente) {
    exigir(typeof q.cliente === "string" && q.cliente.length <= 100, "Búsqueda inválida");
    where.push("(LOWER(COALESCE(p.receptor_nombre,c.nombres,'Consumidor Final') || ' ' || COALESCE(c.apellidos,'')) LIKE :cliente OR COALESCE(p.receptor_nit,c.nit,'CF') ILIKE :cliente)");
    binds.cliente = `%${q.cliente.toLowerCase()}%`;
  }
  return { sql: where.length ? ` WHERE ${where.join(" AND ")}` : "", binds };
}
router.get("/pedidos", permiso("VENTAS_GESTIONAR"), endpoint(async (req, res, c) => {
  const f = filtros(req.query);
  if (![1, 3].includes(req.usuario.ID_ROL)) {
    f.sql += (f.sql ? " AND " : " WHERE ") + "p.id_usuario=:propietario";
    f.binds.propietario = req.usuario.ID_USUARIO;
  }
  const pagina = Number(req.query.pagina || 1);
  exigir(entero(pagina, 1, 100000), "Página inválida");
  res.json(await filas(c, `SELECT p.*,COALESCE(p.receptor_nombre,c.nombres,'Consumidor Final') nombres,c.apellidos,v.id_venta,
    COALESCE((SELECT SUM(monto) FROM pagos WHERE id_venta=v.id_venta),0) pagado,
    COALESCE((SELECT SUM(monto) FROM pagos WHERE id_venta=v.id_venta AND metodo='EFECTIVO'),0) efectivo,
    COALESCE((SELECT SUM(monto) FROM pagos WHERE id_venta=v.id_venta AND metodo='TARJETA'),0) tarjeta,
    COALESCE((SELECT SUM(monto) FROM pagos WHERE id_venta=v.id_venta AND metodo='TRANSFERENCIA'),0) transferencia,
    COALESCE((SELECT SUM(monto) FROM pagos WHERE id_venta=v.id_venta AND metodo='PUNTOS'),0) puntos
    FROM pedidos p LEFT JOIN clientes c ON c.id_cliente=p.id_cliente LEFT JOIN ventas v ON v.id_pedido=p.id_pedido
    ${f.sql} ORDER BY p.id_pedido DESC LIMIT 50 OFFSET :offset`, { ...f.binds, offset: (pagina - 1) * 50 }));
}));
router.get("/pedidos/:id/comprobante", permiso("VENTAS_GESTIONAR"), endpoint(async (req, res, c) => {
  const p = await obtener(c, req.params.id, req.usuario);
  const documento = await comprobante(c, p.ID_PEDIDO);
  await c.commit();
  res.json(documento);
}));
router.get("/pedidos/:id", permiso("VENTAS_GESTIONAR"), endpoint(async (req, res, c) => {
  const p = await obtener(c, req.params.id, req.usuario);
  const [cliente] = p.ID_CLIENTE ? await filas(c, "SELECT puntos FROM clientes WHERE id_cliente=:id", { id: p.ID_CLIENTE }) : [];
  res.json({ pedido: p, puntosDisponibles: cliente?.PUNTOS || 0,
    movimientosPuntos: p.ID_CLIENTE ? await filas(c, "SELECT puntos,saldo,fecha FROM movimientos_puntos WHERE id_cliente=:id ORDER BY id_movimiento DESC LIMIT 50", { id: p.ID_CLIENTE }) : [],
    detalles: await filas(c, "SELECT d.*,p.nombre FROM detalle_pedidos d JOIN productos p ON p.id_producto=d.id_producto WHERE id_pedido=:id", { id: p.ID_PEDIDO }),
    aprobaciones: await filas(c, "SELECT * FROM aprobaciones WHERE id_pedido=:id", { id: p.ID_PEDIDO }),
    pagos: await filas(c, "SELECT g.* FROM pagos g JOIN ventas v ON v.id_venta=g.id_venta WHERE v.id_pedido=:id", { id: p.ID_PEDIDO }),
  });
}));
router.post("/pedidos", permiso("VENTAS_GESTIONAR"),
  (req, res, next) => req.body?.descuento > 0 ? permiso("DESCUENTOS_APLICAR")(req, res, next) : next(),
  endpoint(async (req, res, c) => {
    const b = req.body || {}, ds = validarPedido(b);
    const receptor = b.receptor == null ? null : b.receptor;
    exigir(receptor === null || (b.idCliente === null && typeof receptor === 'object' && !Array.isArray(receptor) &&
      typeof receptor.nombre === 'string' && receptor.nombre.trim().length > 0 && receptor.nombre.trim().length <= 200 &&
      typeof receptor.nit === 'string' && nitValido(receptor.nit.trim().toUpperCase())), 'Nombre y NIT válidos obligatorios para compra sin cuenta');
    const nombre = receptor?.nombre.trim() || null, nit = receptor?.nit.trim().toUpperCase().replace('-', '') || null;
    // Serializa reintentos incluso si llegan simultáneamente.
    await c.execute("SELECT pg_advisory_xact_lock(hashtext(:clave))", { clave: b.clave });
    const [prev] = await filas(c, "SELECT * FROM pedidos WHERE clave=:clave", { clave: b.clave });
    if (prev) {
      exigir(prev.ID_USUARIO === req.usuario.ID_USUARIO, "Clave utilizada", 409);
      const anteriores = await filas(c, "SELECT id_producto,cantidad FROM detalle_pedidos WHERE id_pedido=:id ORDER BY id_producto", { id: prev.ID_PEDIDO });
      exigir(prev.ID_CLIENTE === b.idCliente && prev.DESCUENTO === b.descuento && (prev.RECEPTOR_NOMBRE || null) === nombre && (prev.RECEPTOR_NIT || null) === nit &&
        anteriores.length === ds.length && anteriores.every((d, i) => d.ID_PRODUCTO === ds[i].idProducto && d.CANTIDAD === ds[i].cantidad),
      "La clave pertenece a un pedido con datos distintos", 409);
      return res.json(prev);
    }
    if (b.idCliente !== null) exigir((await filas(c, "SELECT id_cliente FROM clientes WHERE id_cliente=:id AND estado='A' FOR UPDATE", { id: b.idCliente })).length, "Cliente inexistente o inactivo");
    for (const d of ds) {
      const [p] = await filas(c, "SELECT precio,stock FROM productos WHERE id_producto=:id AND estado='A' FOR UPDATE", { id: d.idProducto });
      exigir(p && p.STOCK >= d.cantidad, `Inventario insuficiente o producto inactivo: ${d.idProducto}`, 409);
      d.precio = p.PRECIO;
    }
    const totales = calcular(ds, b.descuento);
    const r = await c.execute("INSERT INTO pedidos(id_cliente,id_usuario,clave,estado,subtotal,descuento,total,receptor_nombre,receptor_nit) VALUES (:cliente,:usuario,:clave,:estado,:subtotal,:descuento,:total,:nombre,:nit) RETURNING id_pedido INTO :id",
      { cliente: b.idCliente, usuario: req.usuario.ID_USUARIO, clave: b.clave, ...totales, descuento: b.descuento, nombre, nit, id: idSalida() });
    const id = r.outBinds.id[0];
    for (const d of ds) await c.execute("INSERT INTO detalle_pedidos(id_pedido,id_producto,cantidad,precio) VALUES (:id,:producto,:cantidad,:precio)", { id, producto: d.idProducto, cantidad: d.cantidad, precio: d.precio });
    await auditar(c, req, "PEDIDO_CREADO", id, JSON.stringify(totales) + ` Descuento: ${b.descuento}%`);
    await c.commit();
    res.status(201).json({ ID_PEDIDO: id, ...totales });
  }));
router.post("/pedidos/:id/decision", permiso("PEDIDOS_APROBAR"), endpoint(async (req, res, c) => {
  const p = await obtener(c, req.params.id, req.usuario), b = req.body || {};
  exigir(p.ESTADO === "PENDIENTE_APROBACION", "El pedido no está pendiente de aprobación", 409);
  exigir(p.ID_USUARIO !== req.usuario.ID_USUARIO, "Otro usuario debe aprobar este pedido", 403);
  exigir(["APROBADO", "RECHAZADO"].includes(b.decision) && typeof b.motivo === "string" && b.motivo.trim().length > 0 && b.motivo.length <= 500, "Decisión y motivo obligatorios");
  if (b.decision === "APROBADO") await inventario(c, p.ID_PEDIDO);
  await c.execute("INSERT INTO aprobaciones(id_pedido,id_usuario,decision,motivo) VALUES (:id,:usuario,:decision,:motivo)", { id: p.ID_PEDIDO, usuario: req.usuario.ID_USUARIO, decision: b.decision, motivo: b.motivo.trim() });
  await c.execute("UPDATE pedidos SET estado=:estado WHERE id_pedido=:id", { estado: b.decision, id: p.ID_PEDIDO });
  await auditar(c, req, b.decision, p.ID_PEDIDO, b.motivo.trim());
  await c.commit(); res.json({ mensaje: "Decisión registrada" });
}));
router.post("/pedidos/:id/cancelar", permiso("VENTAS_GESTIONAR"), endpoint(async (req, res, c) => {
  const p = await obtener(c, req.params.id, req.usuario);
  exigir(["APROBADO", "PENDIENTE_APROBACION"].includes(p.ESTADO), "Este pedido no se puede cancelar", 409);
  await c.execute("UPDATE pedidos SET estado='CANCELADO' WHERE id_pedido=:id", { id: p.ID_PEDIDO });
  await auditar(c, req, "PEDIDO_CANCELADO", p.ID_PEDIDO, "Cancelación antes de venta");
  await c.commit(); res.json({ mensaje: "Pedido cancelado" });
}));
router.post("/pedidos/:id/venta", permiso("VENTAS_GESTIONAR"), endpoint(async (req, res, c) => {
  const p = await obtener(c, req.params.id, req.usuario);
  const [prev] = await filas(c, "SELECT id_venta FROM ventas WHERE id_pedido=:id", { id: p.ID_PEDIDO });
  if (prev) return res.json(prev);
  exigir(p.ESTADO === "APROBADO", "Se requiere un pedido aprobado", 409);
  const ds = await inventario(c, p.ID_PEDIDO);
  const [registrado] = await filas(c, "SELECT * FROM clientes WHERE id_cliente=:id AND estado='A'", { id: p.ID_CLIENTE });
  const cliente = p.ID_CLIENTE === null ? { NOMBRES: p.RECEPTOR_NOMBRE || "Consumidor Final", NIT: p.RECEPTOR_NIT || "CF" } : registrado;
  exigir(cliente, "Cliente inactivo", 409);
  const r = await c.execute("INSERT INTO ventas(id_pedido,id_cliente,id_usuario,cliente_nombre,documento,clave,total) VALUES (:pedido,:cliente,:usuario,:nombre,:documento,:clave,:total) RETURNING id_venta INTO :id",
    { pedido: p.ID_PEDIDO, cliente: p.ID_CLIENTE, usuario: req.usuario.ID_USUARIO, nombre: `${cliente.NOMBRES} ${cliente.APELLIDOS || ""}`.trim(), documento: cliente.NIT, clave: `pedido-${p.ID_PEDIDO}`, total: p.TOTAL, id: idSalida() });
  const id = r.outBinds.id[0];
  for (const d of ds) await c.execute("INSERT INTO detalle_ventas(id_venta,id_producto,cantidad,precio) VALUES (:venta,:producto,:cantidad,:precio)", { venta: id, producto: d.ID_PRODUCTO, cantidad: d.CANTIDAD, precio: d.PRECIO });
  await c.execute("UPDATE pedidos SET estado='VENDIDO' WHERE id_pedido=:id", { id: p.ID_PEDIDO });
  await auditar(c, req, "VENTA_CREADA", p.ID_PEDIDO, `Venta ${id}`);
  await c.commit(); res.status(201).json({ ID_VENTA: id });
}));
router.post("/pedidos/:id/pagos", permiso("PAGOS_REGISTRAR"), endpoint(async (req, res, c) => {
  const b = req.body || {}; validarPago(b);
  const puntos = b.puntos ?? 0;
  exigir(Number.isSafeInteger(puntos) && puntos >= 0, "Puntos inválidos");
  if (b.recibido != null) exigir(b.metodo === "EFECTIVO" && typeof b.recibido === "number" && Number.isFinite(b.recibido) && b.recibido >= b.monto && b.recibido <= 9999999999.99 && Math.abs(b.recibido * 100 - Math.round(b.recibido * 100)) < 1e-6, "Efectivo recibido inválido");
  const p = await obtener(c, req.params.id, req.usuario);
  const [v] = await filas(c, "SELECT id_venta,total FROM ventas WHERE id_pedido=:id", { id: p.ID_PEDIDO });
  exigir(v, "Primero genera la venta", 409);
  const [prev] = await filas(c, "SELECT * FROM pagos WHERE clave=:clave", { clave: b.clave });
  if (prev) {
    exigir(prev.ID_VENTA === v.ID_VENTA && prev.ID_USUARIO === req.usuario.ID_USUARIO && prev.MONTO === (b.monto || puntos / 10) && prev.METODO === (b.monto ? b.metodo : "PUNTOS") && prev.PUNTOS_CANJEADOS === puntos && (prev.RECIBIDO ?? null) === (b.recibido ?? null) && (prev.REFERENCIA || "") === (b.referencia?.trim() || ""), "Clave utilizada por otro pago", 409);
    return res.json({ mensaje: "Pago ya registrado", ID_PAGO: prev.ID_PAGO, completo: p.ESTADO === "PAGADO" });
  }
  exigir(p.ESTADO === "VENDIDO", "La venta no admite pagos", 409);
  const [saldo] = await filas(c, "SELECT COALESCE(SUM(monto),0) pagado FROM pagos WHERE id_venta=:id", { id: v.ID_VENTA });
  exigir(!puntos || p.ID_CLIENTE !== null, "Consumidor Final no participa en puntos");
  const [cliente] = p.ID_CLIENTE ? await filas(c, "SELECT puntos,estado FROM clientes WHERE id_cliente=:id FOR UPDATE", { id: p.ID_CLIENTE }) : [];
  exigir(!p.ID_CLIENTE || cliente?.ESTADO === "A", "Cliente inactivo", 409);
  const valorPuntos = canje(puntos, cliente?.PUNTOS || 0, v.TOTAL - saldo.PAGADO);
  const nuevo = Math.round(saldo.PAGADO * 100) + Math.round(b.monto * 100) + puntos * 10;
  exigir(nuevo <= Math.round(v.TOTAL * 100), "El pago excede el saldo pendiente", 409);
  const completo = nuevo === Math.round(v.TOTAL * 100);
  const ds = completo ? await inventario(c, p.ID_PEDIDO) : [];
  await c.execute("INSERT INTO pagos(id_venta,id_usuario,clave,monto,metodo,referencia,puntos_canjeados,recibido) VALUES (:venta,:usuario,:clave,:monto,:metodo,:referencia,:puntos,:recibido)", { venta: v.ID_VENTA, usuario: req.usuario.ID_USUARIO, clave: b.clave, monto: b.monto || valorPuntos, metodo: b.monto ? b.metodo : "PUNTOS", referencia: b.referencia?.trim() || null, puntos, recibido: b.recibido ?? null });
  if (puntos) {
    if (b.monto) await c.execute("INSERT INTO pagos(id_venta,id_usuario,clave,monto,metodo) VALUES (:venta,:usuario,:clave,:monto,'PUNTOS')", { venta: v.ID_VENTA, usuario: req.usuario.ID_USUARIO, clave: require("node:crypto").createHash("sha256").update(`puntos:${b.clave}`).digest("hex"), monto: valorPuntos });
    await c.execute("UPDATE clientes SET puntos=puntos-:puntos WHERE id_cliente=:id", { puntos, id: p.ID_CLIENTE });
    await c.execute("INSERT INTO movimientos_puntos(id_cliente,id_venta,puntos,saldo) VALUES (:cliente,:venta,:puntos,:saldo)", { cliente: p.ID_CLIENTE, venta: v.ID_VENTA, puntos: -puntos, saldo: cliente.PUNTOS - puntos });
    await auditar(c, req, "PUNTOS_CANJEADOS", p.ID_PEDIDO, `${puntos} puntos: Q${valorPuntos}`);
  }
  for (const d of ds) {
    await c.execute("UPDATE productos SET stock=stock-:cantidad WHERE id_producto=:id", { cantidad: d.CANTIDAD, id: d.ID_PRODUCTO });
    await c.execute("INSERT INTO movimientos_inventario(id_producto,id_venta,id_usuario,tipo,cantidad,stock_anterior,stock_nuevo) VALUES (:producto,:venta,:usuario,'SALIDA_VENTA',:cantidad,:anterior,:nuevo)",
      { producto: d.ID_PRODUCTO, venta: v.ID_VENTA, usuario: req.usuario.ID_USUARIO, cantidad: d.CANTIDAD, anterior: d.stock, nuevo: d.stock - d.CANTIDAD });
  }
  if (completo) {
    if (cliente) {
      const [ingresos] = await filas(c, "SELECT COALESCE(SUM(monto),0) dinero FROM pagos WHERE id_venta=:id AND metodo<>'PUNTOS'", { id: v.ID_VENTA });
      const nuevos = ganar(ingresos.DINERO);
      if (nuevos) {
        await c.execute("UPDATE clientes SET puntos=puntos+:puntos WHERE id_cliente=:id", { puntos: nuevos, id: p.ID_CLIENTE });
        await c.execute("INSERT INTO movimientos_puntos(id_cliente,id_venta,puntos,saldo) VALUES (:cliente,:venta,:puntos,:saldo)", { cliente: p.ID_CLIENTE, venta: v.ID_VENTA, puntos: nuevos, saldo: cliente.PUNTOS - puntos + nuevos });
        await auditar(c, req, "PUNTOS_ACUMULADOS", p.ID_PEDIDO, `${nuevos} puntos`);
      }
    }
    await c.execute("UPDATE pedidos SET estado='PAGADO' WHERE id_pedido=:id", { id: p.ID_PEDIDO });
    await comprobante(c, p.ID_PEDIDO);
    await auditar(c, req, "COMPROBANTE_EMITIDO", p.ID_PEDIDO, `Venta ${v.ID_VENTA}`);
    await auditar(c, req, "SALIDA_INVENTARIO", p.ID_PEDIDO, `Venta ${v.ID_VENTA}`);
  }
  await auditar(c, req, "PAGO_REGISTRADO", p.ID_PEDIDO, `${b.metodo}: Q${b.monto}`);
  await c.commit(); res.status(201).json({ completo, mensaje: completo ? "Pago completo e inventario actualizado" : "Abono registrado" });
}));
router.get("/reportes/sprint3/:tipo", permiso("REPORTES_VER"), endpoint(async (req, res, c) => {
  const f = filtros(req.query);
  exigir(["ventas", "productos"].includes(req.params.tipo), "Reporte inexistente", 404);
  const condicion = f.sql ? `${f.sql} AND p.estado='PAGADO'` : " WHERE p.estado='PAGADO'";
  const sql = req.params.tipo === "ventas"
    ? `SELECT CAST(p.fecha AS DATE) dia,COUNT(*) ventas,SUM(p.subtotal) subtotal,SUM(p.subtotal-p.total) descuentos,SUM(p.total) total,SUM(p.base_imponible) base_imponible,SUM(p.iva) iva,SUM(COALESCE((SELECT SUM(g.monto) FROM pagos g JOIN ventas v ON v.id_venta=g.id_venta WHERE v.id_pedido=p.id_pedido AND g.metodo='PUNTOS'),0)) canje_puntos,SUM(COALESCE((SELECT SUM(g.monto) FROM pagos g JOIN ventas v ON v.id_venta=g.id_venta WHERE v.id_pedido=p.id_pedido AND g.metodo<>'PUNTOS'),0)) ingresos FROM pedidos p LEFT JOIN clientes c ON c.id_cliente=p.id_cliente ${condicion} GROUP BY CAST(p.fecha AS DATE) ORDER BY dia DESC`
    : `SELECT pr.codigo,pr.nombre,SUM(d.cantidad) unidades,SUM(d.cantidad*d.precio) importe_bruto FROM pedidos p LEFT JOIN clientes c ON c.id_cliente=p.id_cliente JOIN detalle_pedidos d ON d.id_pedido=p.id_pedido JOIN productos pr ON pr.id_producto=d.id_producto ${condicion} GROUP BY pr.id_producto,pr.codigo,pr.nombre ORDER BY unidades DESC`;
  res.json(await filas(c, sql, f.binds));
}));
router.get("/auditoria/sprint3", permiso("BITACORA_VER"), endpoint(async (req, res, c) => {
  const id = req.query.pedido ? Number(req.query.pedido) : null;
  exigir(id === null || entero(id), "Pedido inválido");
  res.json(await filas(c, `SELECT * FROM bitacora WHERE tabla_afectada='PEDIDOS' ${id ? "AND id_registro_afectado=:id" : ""} ORDER BY id_bitacora DESC LIMIT 200`, id ? { id } : {}));
}));
module.exports = router;
