require("dotenv").config({ quiet: true });
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");
const { conectar, filas, idSalida } = require("../src/services/db");
const driver = require("../src/config/driver");
const app = require("../src/server");
const { calcular, validarPedido, validarPago } = require("../src/services/pedidos");
let c, server, base, cliente, producto, categoria, rol, usuarios = [], tokens = [];
const marca = `S3_${Date.now()}`;
async function insertar(sql, binds) {
  return (await c.execute(sql + " RETURNING " + ({
    roles: "id_rol", usuarios: "id_usuario", categorias: "id_categoria", productos: "id_producto", clientes: "id_cliente",
  })[sql.match(/INSERT INTO (\w+)/)[1]] + " INTO :id", { ...binds, id: idSalida() })).outBinds.id[0];
}
async function req(path, method = "GET", body, token = tokens[0]) {
  const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
const datos = (extra = {}) => ({ idCliente: cliente, descuento: 0, clave: randomUUID(), detalles: [{ idProducto: producto, cantidad: 2 }], ...extra });
const pago = (monto, extra = {}) => ({ monto, metodo: "EFECTIVO", clave: randomUUID(), ...extra });
async function crear(extra = {}) {
  const r = await req("/pedidos", "POST", datos(extra)); assert.equal(r.status, 201, JSON.stringify(r.data)); return r.data.ID_PEDIDO;
}
const stock = async () => (await filas(c, "SELECT stock FROM productos WHERE id_producto=:id", { id: producto }))[0].STOCK;
before(async () => {
  c = await conectar();
  rol = await insertar("INSERT INTO roles(nombre) VALUES (:nombre)", { nombre: marca });
  for (let i = 0; i < 3; i++) {
    const id = await insertar("INSERT INTO usuarios(nombre_completo,nombre_usuario,contrasena_hash,id_rol) VALUES ('Prueba Sprint 3',:nombre,'SIN_LOGIN',:rol)", { nombre: `${marca}_${i}`, rol: i === 2 ? rol : 1 });
    usuarios.push(id); tokens.push(jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "20m" }));
  }
  categoria = await insertar("INSERT INTO categorias(nombre) VALUES (:nombre)", { nombre: marca });
  producto = await insertar("INSERT INTO productos(codigo,nombre,precio,stock,id_categoria) VALUES (:nombre,:nombre,10,100,:categoria)", { nombre: marca, categoria });
  cliente = await insertar("INSERT INTO clientes(nombres,apellidos,nit) VALUES (:nombre,'Prueba',:nit)", { nombre: marca, nit: String(Date.now()) });
  await c.commit();
  server = app.listen(0, "127.0.0.1"); await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (c) {
    await c.rollback();
    for (const id of usuarios) {
      await c.execute("DELETE FROM movimientos_financieros WHERE id_usuario=:id", { id });
      await c.execute("DELETE FROM bitacora WHERE tabla_afectada='FINANZAS' AND id_usuario=:id", { id });
    }
    if (cliente) {
      const binds = { id: cliente };
      await c.execute("DELETE FROM pagos WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_cliente=:id)", binds);
      await c.execute("DELETE FROM movimientos_inventario WHERE id_producto=:id", { id: producto });
      await c.execute("DELETE FROM detalle_ventas WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_cliente=:id)", binds);
      await c.execute("DELETE FROM ventas WHERE id_cliente=:id", binds);
      await c.execute("DELETE FROM aprobaciones WHERE id_pedido IN (SELECT id_pedido FROM pedidos WHERE id_cliente=:id)", binds);
      await c.execute("DELETE FROM detalle_pedidos WHERE id_pedido IN (SELECT id_pedido FROM pedidos WHERE id_cliente=:id)", binds);
      await c.execute("DELETE FROM bitacora WHERE tabla_afectada='PEDIDOS' AND id_registro_afectado IN (SELECT id_pedido FROM pedidos WHERE id_cliente=:id)", binds);
      await c.execute("DELETE FROM pedidos WHERE id_cliente=:id", binds);
      await c.execute("DELETE FROM clientes WHERE id_cliente=:id", binds);
    }
    if (producto) await c.execute("DELETE FROM productos WHERE id_producto=:id", { id: producto });
    if (categoria) await c.execute("DELETE FROM categorias WHERE id_categoria=:id", { id: categoria });
    for (const id of usuarios) { await c.execute("DELETE FROM bitacora WHERE id_usuario=:id", {id}); await c.execute("DELETE FROM usuarios WHERE id_usuario=:id", { id }); }
    if (rol) {
      await c.execute("DELETE FROM rol_permiso WHERE id_rol=:id", { id: rol });
      await c.execute("DELETE FROM roles WHERE id_rol=:id", { id: rol });
    }
    await c.commit(); await c.close();
  }
  await driver.cerrarPool();
});
test("01 flujo completo: venta, pago, salida y auditoría atómicos", async () => {
  const antes = await stock(), id = await crear();
  assert.equal(await stock(), antes);
  assert.equal((await req(`/pedidos/${id}/venta`, "POST", {})).status, 201);
  assert.equal(await stock(), antes);
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(20))).status, 201);
  assert.equal(await stock(), antes - 2);
  const d = (await req(`/pedidos/${id}`)).data;
  assert.equal(d.pedido.ESTADO, "PAGADO"); assert.equal(d.pagos.length, 1);
  const a = (await req(`/auditoria/sprint3?pedido=${id}`)).data;
  assert.ok(a.some((v) => v.ACCION === "SALIDA_INVENTARIO"));
  assert.ok(a.some((v) => v.ACCION === "PAGO_REGISTRADO"));
});
test("02 sin inventario no crea pedido", async () => {
  assert.equal((await req("/pedidos", "POST", datos({ detalles: [{ idProducto: producto, cantidad: 1000 }] }))).status, 409);
});
test("03 descuento alto exige aprobación independiente", async () => {
  const id = await crear({ descuento: 20 });
  assert.equal((await req(`/pedidos/${id}/venta`, "POST", {})).status, 409);
  const body = { decision: "APROBADO", motivo: "Descuento autorizado" };
  assert.equal((await req(`/pedidos/${id}/decision`, "POST", body)).status, 403);
  assert.equal((await req(`/pedidos/${id}/decision`, "POST", body, tokens[1])).status, 200);
  assert.equal((await req(`/pedidos/${id}/venta`, "POST", {})).status, 201);
});
test("04 descuento calculado por servidor e ignorar precios enviados", async () => {
  const id = await crear({ descuento: 10, detalles: [{ idProducto: producto, cantidad: 2, precio: 0.01 }] });
  assert.equal((await req(`/pedidos/${id}`)).data.pedido.TOTAL, 18);
});
test("05 abonos no descuentan stock; saldo final sí", async () => {
  const id = await crear(), antes = await stock();
  await req(`/pedidos/${id}/venta`, "POST", {});
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(5))).status, 201);
  assert.equal(await stock(), antes);
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(15))).status, 201);
  assert.equal(await stock(), antes - 2);
});
test("06 sobrepago rechazado sin persistencia", async () => {
  const id = await crear(); await req(`/pedidos/${id}/venta`, "POST", {});
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(21))).status, 409);
  assert.equal((await req(`/pedidos/${id}`)).data.pagos.length, 0);
});
test("07 reintentos simultáneos no duplican pedido ni venta", async () => {
  const b = datos(), results = await Promise.all([req("/pedidos", "POST", b), req("/pedidos", "POST", b)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
  const id = results[0].data.ID_PEDIDO; assert.equal(id, results[1].data.ID_PEDIDO);
  const vs = await Promise.all([req(`/pedidos/${id}/venta`, "POST", {}), req(`/pedidos/${id}/venta`, "POST", {})]);
  assert.deepEqual(vs.map((r) => r.status).sort(), [200, 201]);
  assert.equal(vs[0].data.ID_VENTA, vs[1].data.ID_VENTA);
});
test("08 pago simultáneo repetido descuenta una sola vez", async () => {
  const id = await crear(), antes = await stock(), b = pago(20);
  await req(`/pedidos/${id}/venta`, "POST", {});
  const rs = await Promise.all([req(`/pedidos/${id}/pagos`, "POST", b), req(`/pedidos/${id}/pagos`, "POST", b)]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 201]);
  assert.equal(await stock(), antes - 2);
});
test("09 permisos restringen todas las operaciones sensibles", async () => {
  const id = await crear();
  for (const [path, method, body] of [
    ["/pedidos", "GET"], ["/pedidos", "POST", datos()],
    [`/pedidos/${id}/comprobante`, "GET"],
    [`/pedidos/${id}/decision`, "POST", { decision: "APROBADO", motivo: "x" }],
    [`/pedidos/${id}/venta`, "POST", {}], [`/pedidos/${id}/pagos`, "POST", pago(20)],
    ["/reportes/sprint3/ventas", "GET"], ["/auditoria/sprint3", "GET"],
  ]) assert.equal((await req(path, method, body, tokens[2])).status, 403, path);
});
test("10 cancelación impide venta; rechazo guarda motivo", async () => {
  const id = await crear(); assert.equal((await req(`/pedidos/${id}/cancelar`, "POST", {})).status, 200);
  assert.equal((await req(`/pedidos/${id}/venta`, "POST", {})).status, 409);
  const otro = await crear({ descuento: 15 });
  assert.equal((await req(`/pedidos/${otro}/decision`, "POST", { decision: "RECHAZADO", motivo: "No autorizado" }, tokens[1])).status, 200);
  assert.equal((await req(`/pedidos/${otro}`)).data.aprobaciones[0].MOTIVO, "No autorizado");
});
test("11 inventario agotado al pagar revierte pago completo", async () => {
  const id = await crear(), antes = await stock(); await req(`/pedidos/${id}/venta`, "POST", {});
  await c.execute("UPDATE productos SET stock=0 WHERE id_producto=:id", { id: producto }); await c.commit();
  try {
    assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(20))).status, 409);
    const d = (await req(`/pedidos/${id}`)).data;
    assert.equal(d.pagos.length, 0); assert.equal(d.pedido.ESTADO, "VENDIDO");
  } finally { await c.execute("UPDATE productos SET stock=:stock WHERE id_producto=:id", { stock: antes, id: producto }); await c.commit(); }
});
test("12 búsquedas combinadas y fechas inválidas", async () => {
  const r = await req(`/pedidos?cliente=${marca}&estado=PAGADO&desde=2020-01-01&hasta=2099-12-31`);
  assert.equal(r.status, 200); assert.ok(r.data.length > 0); assert.ok(r.data.every((p) => p.ESTADO === "PAGADO"));
  assert.equal((await req("/pedidos?desde=2026-02-30")).status, 400);
  assert.equal((await req("/pedidos?pagina=-1")).status, 400);
});
test("13 reportes concilian ventas pagadas y unidades", async () => {
  const vs = await req(`/reportes/sprint3/ventas?cliente=${marca}`), ps = await req(`/reportes/sprint3/productos?cliente=${marca}`);
  assert.equal(vs.status, 200); assert.equal(ps.status, 200);
  assert.equal(vs.data.reduce((n, d) => n + d.TOTAL, 0), 60);
  assert.equal(ps.data[0].UNIDADES, 6);
});
test("14 límites, redondeos y umbral de aprobación", () => {
  assert.equal(calcular([{ precio: 0.1, cantidad: 3 }], 10).total, 0.27);
  assert.equal(calcular([{ precio: 5000, cantidad: 1 }], 0).estado, "PENDIENTE_APROBACION");
  for (const descuento of [-1, 51, NaN, 1.234]) assert.throws(() => validarPedido(datos({ descuento })));
  assert.throws(() => validarPedido(datos({ detalles: [{ idProducto: producto, cantidad: 0 }] })));
  assert.throws(() => validarPago(pago(1.001)));
  assert.throws(() => validarPago(pago(2, { metodo: "TARJETA" })));
});
test("15 ruta antigua no permite omitir el flujo", async () => {
  assert.equal((await req("/ventas", "POST", {})).status, 409);
});
test("16 cliente inactivo y productos repetidos rechazados", async () => {
  assert.equal((await req("/pedidos", "POST", datos({ detalles: [{ idProducto: producto, cantidad: 1 }, { idProducto: producto, cantidad: 1 }] }))).status, 400);
  await c.execute("UPDATE clientes SET estado='I' WHERE id_cliente=:id", { id: cliente }); await c.commit();
  try { assert.equal((await req("/pedidos", "POST", datos())).status, 400); }
  finally { await c.execute("UPDATE clientes SET estado='A' WHERE id_cliente=:id", { id: cliente }); await c.commit(); }
});
test("17 claves reutilizadas con datos distintos generan conflicto", async () => {
  const b = datos(), r = await req("/pedidos", "POST", b), id = r.data.ID_PEDIDO;
  assert.equal((await req("/pedidos", "POST", { ...b, descuento: 5 })).status, 409);
  await req(`/pedidos/${id}/venta`, "POST", {});
  const abono = pago(5);
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", abono)).status, 201);
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", { ...abono, monto: 6 })).status, 409);
});
test("18 dos pedidos compiten por último stock sin sobreventa", async () => {
  const antes = await stock(), a = await crear(), b = await crear();
  await req(`/pedidos/${a}/venta`, "POST", {}); await req(`/pedidos/${b}/venta`, "POST", {});
  await c.execute("UPDATE productos SET stock=2 WHERE id_producto=:id", { id: producto }); await c.commit();
  try {
    const rs = await Promise.all([req(`/pedidos/${a}/pagos`, "POST", pago(20)), req(`/pedidos/${b}/pagos`, "POST", pago(20))]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await stock(), 0);
    const da = (await req(`/pedidos/${a}`)).data, db = (await req(`/pedidos/${b}`)).data;
    assert.equal(da.pagos.length + db.pagos.length, 1);
  } finally { await c.execute("UPDATE productos SET stock=:stock WHERE id_producto=:id", { stock: antes, id: producto }); await c.commit(); }
});
test("19 vendedor sin permiso específico no aplica descuentos", async () => {
  await c.execute("INSERT INTO rol_permiso(id_rol,id_permiso) SELECT :rol,id_permiso FROM permisos WHERE codigo='VENTAS_GESTIONAR'", { rol }); await c.commit();
  assert.equal((await req("/pedidos", "POST", datos({ descuento: 5 }), tokens[2])).status, 403);
});

test("20 caja: puntos más efectivo, acumulación y reintento sin duplicar", async () => {
  await c.execute("UPDATE clientes SET puntos=100 WHERE id_cliente=:id", { id: cliente }); await c.commit();
  const id = await crear({ detalles: [{ idProducto: producto, cantidad: 11 }] });
  await req(`/pedidos/${id}/venta`, "POST", {});
  const b = pago(100, { puntos: 100, recibido: 120 });
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", b)).status, 201);
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", b)).status, 200);
  const d = (await req(`/pedidos/${id}`)).data;
  assert.equal(d.puntosDisponibles, 10);
  const listado = (await req("/pedidos")).data.find(p => p.ID_PEDIDO === id);
  assert.equal(listado.EFECTIVO, 100);
  assert.equal(listado.PUNTOS, 10);
  assert.equal(listado.TARJETA, 0);
  assert.equal(listado.TRANSFERENCIA, 0);
  assert.equal(d.pedido.BASE_IMPONIBLE, 98.21);
  assert.equal(d.pedido.IVA, 11.79);
  assert.equal(d.pagos.length, 2);
  assert.equal(d.pagos.reduce((n, p) => n + p.MONTO, 0), 110);
  assert.equal(d.pedido.ESTADO, "PAGADO");
  const recibo = await req(`/pedidos/${id}/comprobante`);
  assert.equal(recibo.status, 200);
  assert.equal(recibo.data.venta.TOTAL, 110);
  assert.equal(recibo.data.venta.IVA, 11.79);
  assert.equal(recibo.data.pagos.length, 2);
  assert.equal(recibo.data.detalles[0].CANTIDAD, 11);
  assert.equal((await req(`/pedidos/${id}/comprobante`, "GET", undefined, "invalido")).status, 401);
  await c.execute("UPDATE productos SET nombre='Nombre temporal' WHERE id_producto=:id", { id: producto }); await c.commit();
  try {
    assert.deepEqual((await req(`/pedidos/${id}/comprobante`)).data, recibo.data);
  } finally {
    await c.execute("UPDATE productos SET nombre=:nombre WHERE id_producto=:id", { id: producto, nombre: marca }); await c.commit();
  }
});
test("25 IVA incluido: total intacto, descuento, venta y reporte conciliados", async () => {
  await c.execute("UPDATE productos SET precio=112 WHERE id_producto=:id", { id: producto }); await c.commit();
  try {
    const id = await crear({ detalles: [{ idProducto: producto, cantidad: 1 }] });
    const d = (await req(`/pedidos/${id}`)).data.pedido;
    assert.equal(d.TOTAL, 112); assert.equal(d.BASE_IMPONIBLE, 100);
    assert.equal(d.IVA, 12); assert.equal(d.IVA_TASA, 12);
    await req(`/pedidos/${id}/venta`, "POST", {});
    assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(112))).status, 201);
    const [v] = await filas(c, "SELECT total,base_imponible,iva FROM ventas WHERE id_pedido=:id", { id });
    assert.equal(v.TOTAL, 112); assert.equal(v.BASE_IMPONIBLE, 100); assert.equal(v.IVA, 12);
    const idDescuento = await crear({ descuento: 10, detalles: [{ idProducto: producto, cantidad: 1 }] });
    const descuento = (await req(`/pedidos/${idDescuento}`)).data.pedido;
    assert.equal(descuento.TOTAL, 100.8); assert.equal(descuento.BASE_IMPONIBLE, 90); assert.equal(descuento.IVA, 10.8);
    const reporte = await req(`/reportes/sprint3/ventas?cliente=${marca}`);
    assert.equal(reporte.status, 200);
    for (const fila of reporte.data) assert.equal(Math.round((fila.BASE_IMPONIBLE + fila.IVA) * 100), Math.round(fila.TOTAL * 100));
  } finally {
    await c.execute("UPDATE productos SET precio=10 WHERE id_producto=:id", { id: producto }); await c.commit();
  }
});
test("21 caja: saldo insuficiente revierte pago", async () => {
  const id = await crear(); await req(`/pedidos/${id}/venta`, "POST", {});
  assert.equal((await req(`/pedidos/${id}/comprobante`)).status, 409);
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(10, { puntos: 100 }))).status, 409);
  assert.equal((await req(`/pedidos/${id}`)).data.pagos.length, 0);
});
test("22 caja: pago completo con puntos no acumula puntos nuevos", async () => {
  await c.execute("UPDATE clientes SET puntos=200 WHERE id_cliente=:id", { id: cliente }); await c.commit();
  const id = await crear(); await req(`/pedidos/${id}/venta`, "POST", {});
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(0, { puntos: 200 }))).status, 201);
  const d = (await req(`/pedidos/${id}`)).data;
  assert.equal(d.puntosDisponibles, 0); assert.equal(d.pedido.ESTADO, "PAGADO");
});
test("23 caja: efectivo recibido insuficiente no registra pago", async () => {
  const id = await crear(); await req(`/pedidos/${id}/venta`, "POST", {});
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(20, { recibido: 10 }))).status, 400);
});
test("24 caja: Consumidor Final puede comprar pero no canjear", async () => {
  const id = await crear({ idCliente: null });
  try {
    assert.equal((await req(`/pedidos/${id}/venta`, "POST", {})).status, 201);
    assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(10, { puntos: 100 }))).status, 400);
    assert.equal((await req(`/pedidos/${id}/pagos`, "POST", pago(20))).status, 201);
    assert.equal((await req(`/pedidos/${id}`)).data.puntosDisponibles, 0);
    assert.ok((await req("/pedidos?cliente=CF")).data.some(p => p.ID_PEDIDO === id));
  } finally {
    await c.execute("DELETE FROM pagos WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_pedido=:id)", { id });
    await c.execute("DELETE FROM movimientos_inventario WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_pedido=:id)", { id });
    await c.execute("DELETE FROM detalle_ventas WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_pedido=:id)", { id });
    await c.execute("DELETE FROM ventas WHERE id_pedido=:id", { id });
    await c.execute("DELETE FROM detalle_pedidos WHERE id_pedido=:id", { id });
    await c.execute("DELETE FROM bitacora WHERE tabla_afectada='PEDIDOS' AND id_registro_afectado=:id", { id });
    await c.execute("DELETE FROM pedidos WHERE id_pedido=:id", { id }); await c.commit();
  }
});

const movimiento = (extra = {}) => ({ clave: randomUUID(), categoria: "GASTO", metodo: "EFECTIVO", monto: 7.25, fecha: "2000-01-02", concepto: marca, ...extra });
test("26 finanzas: ingresos, egresos, saldo, rango y reintentos", async () => {
  const url = "/finanzas/resumen?desde=2000-01-02&hasta=2000-01-02";
  const antes = (await req(url)).data.totales;
  const b = movimiento();
  const egreso = await req("/finanzas/movimientos", "POST", b);
  assert.equal(egreso.status, 201, JSON.stringify(egreso.data));
  assert.equal((await req("/finanzas/movimientos", "POST", b)).status, 200);
  assert.equal((await req("/finanzas/movimientos", "POST", { ...b, monto: 8 })).status, 409);
  assert.equal((await req("/finanzas/movimientos", "POST", movimiento({ categoria: "OTRO_INGRESO", monto: 20 }))).status, 201);
  const r = (await req(url)).data;
  assert.equal(Math.round((r.totales.INGRESOS - antes.INGRESOS) * 100), 2000);
  assert.equal(Math.round((r.totales.EGRESOS - antes.EGRESOS) * 100), 725);
  assert.equal(Math.round((r.totales.SALDO - antes.SALDO) * 100), 1275);
  assert.equal((await req(`/finanzas/movimientos/${egreso.data.id}/anular`, "POST", { motivo: "Error de captura" })).status, 200);
  assert.equal((await req(`/finanzas/movimientos/${egreso.data.id}/anular`, "POST", { motivo: "Error de captura" })).status, 200);
  assert.equal((await req(url)).data.totales.EGRESOS, antes.EGRESOS);
  assert.equal((await req("/finanzas/resumen?desde=2026-02-30&hasta=2026-03-01")).status, 400);
});
test("27 finanzas: no cuenta puntos y usa la fecha del cobro", async () => {
  const r = await req("/finanzas/resumen?desde=1900-01-01&hasta=2999-12-31");
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const [esperado] = await filas(c, "SELECT COALESCE(SUM(monto),0) total FROM pagos WHERE metodo<>'PUNTOS'");
  const [manual] = await filas(c, "SELECT COALESCE(SUM(monto),0) total FROM movimientos_financieros WHERE tipo='INGRESO' AND anulado_en IS NULL");
  assert.equal(Math.round(r.data.totales.INGRESOS * 100), Math.round(esperado.TOTAL * 100) + Math.round(manual.TOTAL * 100));
});
test("28 empleados: finanzas y administracion bloqueadas aun con permisos asignados", async () => {
  await c.execute("INSERT INTO rol_permiso(id_rol,id_permiso) SELECT :rol,id_permiso FROM permisos WHERE codigo IN ('FINANZAS_GESTIONAR','REPORTES_VER','BITACORA_VER','COMPRAS_GESTIONAR','PROVEEDORES_GESTIONAR','ROLES_GESTIONAR','USUARIOS_GESTIONAR') ON CONFLICT DO NOTHING", { rol }); await c.commit();
  for (const path of ["/finanzas/resumen?desde=2000-01-01&hasta=2999-01-01", "/finanzas/compras-pendientes", "/reportes/sprint3/ventas", "/auditoria/sprint3", "/compras", "/proveedores", "/roles", "/usuarios"]) {
    assert.equal((await req(path, "GET", undefined, tokens[2])).status, 403, path);
  }
  assert.equal((await req("/finanzas/movimientos", "POST", movimiento(), tokens[2])).status, 403);
  assert.equal((await req("/finanzas/movimientos/1/anular", "POST", { motivo: "x" }, tokens[2])).status, 403);
  const acceso = await req("/auth/permisos", "GET", undefined, tokens[2]);
  assert.equal(acceso.status,200,JSON.stringify(acceso.data));
  const permisos = acceso.data.permisos;
  assert.ok(!permisos.includes("FINANZAS_GESTIONAR")); assert.ok(!permisos.includes("COMPRAS_GESTIONAR"));
  const id = await crear();
  assert.equal((await req(`/pedidos/${id}`, "GET", undefined, tokens[2])).status, 403);
  assert.equal((await req(`/pedidos/${id}/comprobante`, "GET", undefined, tokens[2])).status, 403);
  assert.ok(!(await req("/pedidos", "GET", undefined, tokens[2])).data.some(p => p.ID_PEDIDO === id));
});
test("29 finanzas: rechaza montos, puntos y fechas invalidos", async () => {
  for (const extra of [{ monto: -1 }, { monto: 0 }, { monto: 1.234 }, { metodo: "PUNTOS" }, { fecha: "2999-01-01" }, { categoria: "COMPRA", idCompra: null }]) {
    assert.equal((await req("/finanzas/movimientos", "POST", movimiento(extra))).status, 400, JSON.stringify(extra));
  }
});

test("30 finanzas: pagos de compra concurrentes no exceden su total", async () => {
  const prov = (await c.execute("INSERT INTO proveedores(nombre,nit) VALUES (:nombre,:nit) RETURNING id_proveedor INTO :id", { nombre: marca, nit: marca, id: idSalida() })).outBinds.id[0];
  const compra = (await c.execute("INSERT INTO compras(id_proveedor,id_usuario,factura,clave,total) VALUES (:prov,:usuario,:factura,:clave,80) RETURNING id_compra INTO :id", { prov, usuario: usuarios[0], factura: marca, clave: randomUUID(), id: idSalida() })).outBinds.id[0]; await c.commit();
  try {
    const pagos = await Promise.all([1, 2].map(() => req("/finanzas/movimientos", "POST", movimiento({ categoria: "COMPRA", idCompra: compra, monto: 60 }))));
    assert.deepEqual(pagos.map(r => r.status).sort(), [201, 409]);
    assert.equal((await req("/finanzas/compras-pendientes")).data.find(r => r.ID_COMPRA === compra).PENDIENTE, 20);
  } finally {
    await c.execute("DELETE FROM movimientos_financieros WHERE id_compra=:id", { id: compra });
    await c.execute("DELETE FROM compras WHERE id_compra=:id", { id: compra });
    await c.execute("DELETE FROM proveedores WHERE id_proveedor=:id", { id: prov }); await c.commit();
  }
});

test("31 finanzas: apertura, saldo anterior y duplicados", async (t) => {
  const aperturas = await filas(c, "SELECT metodo FROM movimientos_financieros WHERE tipo='APERTURA' AND anulado_en IS NULL");
  const metodo = ["TARJETA", "TRANSFERENCIA", "EFECTIVO"].find(m => !aperturas.some(a => a.METODO === m));
  if (!metodo) return t.skip("Ya existen aperturas reales para todos los metodos");
  const consulta = "/finanzas/resumen?desde=1900-01-02&hasta=1900-01-02";
  const antes = (await req(consulta)).data.totales;
  const b = movimiento({ categoria: "SALDO_INICIAL", metodo, monto: 100, fecha: "1900-01-01" });
  assert.equal((await req("/finanzas/movimientos", "POST", b)).status, 201);
  assert.equal((await req("/finanzas/movimientos", "POST", b)).status, 200);
  assert.equal((await req("/finanzas/movimientos", "POST", { ...b, clave: randomUUID() })).status, 409);
  const d = (await req(consulta)).data.totales;
  assert.equal(Math.round((d.SALDO_ANTERIOR - antes.SALDO_ANTERIOR) * 100), 10000);
  assert.equal(d.INGRESOS, antes.INGRESOS);
  assert.equal(Math.round((d.SALDO - antes.SALDO) * 100), 10000);
  assert.equal((await req("/finanzas/movimientos", "POST", movimiento({ metodo, fecha: "1899-12-31" }))).status, 409);
});

test("32 compras pagadas descuentan saldo y reintentos no duplican", async () => {
  const prov = (await c.execute("INSERT INTO proveedores(nombre,nit) VALUES (:nombre,:nit) RETURNING id_proveedor INTO :id", { nombre: marca, nit: marca, id: idSalida() })).outBinds.id[0]; await c.commit();
  const ids = [];
  try {
    const b = { idProveedor: prov, factura: marca + "-P", clave: randomUUID(), detalles: [{ idProducto: producto, cantidad: 2, costo: 12.5 }], pago: { metodo: "EFECTIVO", referencia: "" } };
    const antes = (await req("/finanzas/resumen?desde=1900-01-01&hasta=2999-12-31")).data.totales;
    const r = await req("/compras", "POST", b);
    assert.equal(r.status, 201, JSON.stringify(r.data)); ids.push(r.data.id);
    assert.equal((await req("/compras", "POST", b)).status, 200);
    const [pagoCompra] = await filas(c, "SELECT COUNT(*) n,SUM(monto) monto FROM movimientos_financieros WHERE id_compra=:id", { id: r.data.id });
    assert.equal(pagoCompra.N, 1); assert.equal(pagoCompra.MONTO, 25);
    const ahora = (await req("/finanzas/resumen?desde=1900-01-01&hasta=2999-12-31")).data.totales;
    assert.equal(Math.round((ahora.EGRESOS - antes.EGRESOS)*100),2500);
    assert.equal(Math.round((ahora.SALDO - antes.SALDO)*100),-2500);
    assert.equal((await req(`/compras/${r.data.id}`)).data.compra.PENDIENTE_PAGO,0);
    const credito = await req("/compras", "POST", { ...b, factura: marca + "-C", clave: randomUUID(), pago: null });
    assert.equal(credito.status,201); ids.push(credito.data.id);
    assert.equal((await req(`/compras/${credito.data.id}`)).data.compra.PENDIENTE_PAGO,25);
    assert.equal((await req("/finanzas/resumen?desde=1900-01-01&hasta=2999-12-31")).data.totales.SALDO,ahora.SALDO);
    assert.equal((await req("/compras", "POST", { ...b, clave:randomUUID(),pago:{metodo:"PUNTOS"} })).status,400);
  } finally {
    for(const id of ids){
      await c.execute("DELETE FROM movimientos_financieros WHERE id_compra=:id",{id});
      await c.execute("DELETE FROM movimientos_inventario WHERE id_recepcion IN (SELECT id_recepcion FROM recepciones WHERE id_compra=:id)",{id});
      await c.execute("DELETE FROM recepciones WHERE id_compra=:id",{id});
      await c.execute("DELETE FROM detalle_compras WHERE id_compra=:id",{id});
      await c.execute("DELETE FROM bitacora WHERE tabla_afectada='COMPRAS' AND id_registro_afectado=:id",{id});
      await c.execute("DELETE FROM compras WHERE id_compra=:id",{id});
    }
    await c.execute("DELETE FROM proveedores WHERE id_proveedor=:id",{id:prov});await c.commit();
  }
});
test("33 carnet privado por usuario y sueldo validado", async () => {
  await c.execute("UPDATE usuarios SET sueldo=3500,horario='Lunes a viernes 08:00-17:00',puesto='Cajero' WHERE id_usuario=:id",{id:usuarios[2]});await c.commit();
  const r = await req("/empleado/mi-carnet?id=1", "GET", undefined, tokens[2]);
  assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.empleado.ID_USUARIO,usuarios[2]);assert.equal(r.data.empleado.SUELDO,3500);
  assert.equal(r.data.ventas.length,0);
  assert.equal((await req("/usuarios", "POST", {nombreCompleto:"Ana",nombreUsuario:"ana",correo:"a@example.invalid",contrasena:"Abc123456",idRol:rol,sueldo:-1})).status,400);
  assert.equal((await req("/usuarios", "POST", {nombreCompleto:"Ana",idRol:rol,sueldo:100},tokens[2])).status,403);
});


test("34 NIT sin cuenta conserva receptor, no crea cliente ni permite puntos", async()=>{
  const b=datos({idCliente:null,receptor:{nombre:"Cliente ocasional",nit:"1234567-8"}});
  const antes=(await filas(c,"SELECT COUNT(*) n FROM clientes WHERE nit='12345678'"))[0].N;
  const r=await req('/pedidos','POST',b);assert.equal(r.status,201,JSON.stringify(r.data));const id=r.data.ID_PEDIDO;
  try{
    assert.equal((await req('/pedidos','POST',b)).status,200);
    assert.equal((await req('/pedidos','POST',{...b,receptor:{...b.receptor,nit:'12345679'}})).status,409);
    assert.equal((await req('/pedidos','POST',datos({receptor:b.receptor}))).status,400);
    assert.equal((await req('/pedidos','POST',datos({idCliente:null,receptor:{nombre:'',nit:'CF'}}))).status,400);
    assert.equal((await req(`/pedidos/${id}/venta`,'POST',{})).status,201);
    assert.equal((await req(`/pedidos/${id}/pagos`,'POST',pago(10,{puntos:100}))).status,400);
    assert.equal((await req(`/pedidos/${id}/pagos`,'POST',pago(20))).status,201);
    const comprobante=(await req(`/pedidos/${id}/comprobante`)).data;
    assert.equal(comprobante.venta.DOCUMENTO,'12345678');assert.equal(comprobante.venta.CLIENTE_NOMBRE,'Cliente ocasional');
    assert.equal((await filas(c,"SELECT COUNT(*) n FROM clientes WHERE nit='12345678'"))[0].N,antes);
    assert.ok((await req('/pedidos?cliente=12345678')).data.some(p=>p.ID_PEDIDO===id));
  }finally{
    for(const tabla of ['pagos','movimientos_inventario','detalle_ventas'])await c.execute(`DELETE FROM ${tabla} WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_pedido=:id)`,{id});
    await c.execute('DELETE FROM ventas WHERE id_pedido=:id',{id});
    await c.execute('DELETE FROM detalle_pedidos WHERE id_pedido=:id',{id});
    await c.execute("DELETE FROM bitacora WHERE tabla_afectada='PEDIDOS' AND id_registro_afectado=:id",{id});
    await c.execute('DELETE FROM pedidos WHERE id_pedido=:id',{id});await c.commit();
  }
});
test("35 Dueño administra y eliminacion protege historial y cuenta propia",async()=>{
  const temporal=await insertar("INSERT INTO usuarios(nombre_completo,nombre_usuario,contrasena_hash,id_rol) VALUES ('Empleado Temporal',:nombre,'SIN_LOGIN',2)",{nombre:marca+'_eliminar'});
  await c.execute('UPDATE usuarios SET id_rol=3 WHERE id_usuario=:id',{id:usuarios[1]});await c.commit();
  try{
    assert.equal((await req(`/usuarios/${temporal}`,'DELETE',undefined,tokens[2])).status,403);
    assert.equal((await req(`/usuarios/${usuarios[1]}`,'DELETE',undefined,tokens[1])).status,403);
    const id=await crear();
    assert.equal((await req(`/pedidos/${id}`,'GET',undefined,tokens[1])).status,200);
    assert.equal((await req('/finanzas/resumen?desde=2000-01-01&hasta=2100-01-01','GET',undefined,tokens[1])).status,200);
    const roles=(await req('/usuarios/roles-asignables','GET',undefined,tokens[1])).data;
    assert.ok(roles.some(r=>r.ID_ROL===3));
    assert.equal((await req('/roles/3/permisos','PUT',{permisos:[]},tokens[1])).status,403);
    assert.equal((await req(`/usuarios/${usuarios[0]}`,'DELETE',undefined,tokens[1])).status,409);
    assert.equal((await req(`/usuarios/${temporal}`,'DELETE',undefined,tokens[1])).status,200);
    assert.equal((await filas(c,'SELECT id_usuario FROM usuarios WHERE id_usuario=:id',{id:temporal})).length,0);
    assert.ok((await filas(c,"SELECT id_bitacora FROM bitacora WHERE accion='USUARIO_ELIMINADO' AND id_registro_afectado=:id",{id:temporal})).length);
  }finally{await c.execute('DELETE FROM usuarios WHERE id_usuario=:id',{id:temporal});await c.execute('UPDATE usuarios SET id_rol=1 WHERE id_usuario=:id',{id:usuarios[1]});await c.commit();}
});
test("36 exportacion financiera incluye mas de una pagina y restringe empleados",async()=>{
  await c.execute("INSERT INTO movimientos_financieros(id_usuario,clave,tipo,categoria,metodo,monto,fecha,concepto) SELECT :usuario,:marca || '-' || i,'EGRESO','GASTO','EFECTIVO',1,DATE '2001-01-01',:marca FROM generate_series(1,51) i",{usuario:usuarios[0],marca});await c.commit();
  const url='/finanzas/exportar?desde=2001-01-01&hasta=2001-01-01';
  const r=await req(url);assert.equal(r.status,200);assert.equal(r.data.filter(m=>m.CONCEPTO===marca).length,51);
  assert.equal((await req(url,'GET',undefined,tokens[2])).status,403);
  assert.equal((await req('/finanzas/exportar?desde=mal&hasta=2001-01-01')).status,400);
});


test("37 vendedor registra cliente desde caja sin permiso de administrar clientes",async()=>{
  await c.execute("INSERT INTO rol_permiso(id_rol,id_permiso) SELECT :rol,id_permiso FROM permisos WHERE codigo='VENTAS_GESTIONAR' ON CONFLICT DO NOTHING",{rol});
  await c.execute("DELETE FROM rol_permiso WHERE id_rol=:rol AND id_permiso IN (SELECT id_permiso FROM permisos WHERE codigo='CLIENTES_CREAR')",{rol});await c.commit();
  const b={nombres:'Cliente Caja',nit:'',correo:`${marca.toLowerCase()}@example.invalid`};
  assert.equal((await req('/clientes','POST',b,tokens[2])).status,403);
  const r=await req('/ventas/clientes','POST',b,tokens[2]);assert.equal(r.status,201,JSON.stringify(r.data));
  try{assert.ok(r.data.id);assert.equal((await req('/ventas/clientes','POST',b,tokens[2])).status,409);}
  finally{await c.execute('DELETE FROM clientes WHERE id_cliente=:id',{id:r.data.id});await c.commit();}
});
