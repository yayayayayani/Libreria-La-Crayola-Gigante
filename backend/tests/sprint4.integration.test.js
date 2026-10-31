require("dotenv").config({ quiet: true });
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("node:crypto");
const driver = require("../src/config/driver");
const { conectar, filas } = require("../src/services/db");
const app = require("../src/server");
if (!/^sprint4_test_[a-f0-9]{16}$/.test(process.env.CRAYOLA_TEST_SCHEMA || "")) throw new Error("Ejecuta con npm run test:integration");
let c, server, base, admin, empleado, producto, categoria, cliente, proveedor;
const req = async (ruta, method = "GET", body, token = admin) => {
  const r = await fetch(base + ruta, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};
const insertar = async (sql, binds = {}) => (await c.execute(sql, binds)).rows[0][0];
before(async () => {
  c = await conectar();
  const rol = await insertar("INSERT INTO roles(nombre) VALUES ('S4 sin permisos') RETURNING id_rol");
  for (const [r, nombre] of [[1, "s4admin"], [rol, "s4empleado"]]) {
    const id = await insertar("INSERT INTO usuarios(nombre_completo,nombre_usuario,contrasena_hash,id_rol) VALUES ('Prueba',:nombre,'NO_LOGIN',:rol) RETURNING id_usuario", { nombre, rol: r });
    const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "10m" });
    if (r === 1) admin = token; else empleado = token;
  }
  categoria = await insertar("INSERT INTO categorias(nombre) VALUES ('S4 Categoría') RETURNING id_categoria");
  cliente = await insertar("INSERT INTO clientes(nombres) VALUES ('S4 Cliente') RETURNING id_cliente");
  producto = await insertar("INSERT INTO productos(codigo,nombre,precio,stock,stock_minimo,id_categoria) VALUES ('S4','S4 Producto',10,12,10,:categoria) RETURNING id_producto", { categoria });
  proveedor = await insertar("INSERT INTO proveedores(nombre,nit) VALUES ('S4 Proveedor','12345678') RETURNING id_proveedor");
  await c.commit();
  server = app.listen(0, "127.0.0.1"); await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { if (server) await new Promise(r => server.close(r)); if (c) await c.close(); await driver.cerrarPool(); });
const periodo = "desde=2026-01-01&hasta=2026-12-31";
test("panel, reportes y auditoría exigen permisos; validan fechas y páginas", async () => {
  for (const path of ["/dashboard/resumen", "/reportes/sprint4/inventario", "/auditoria"]) assert.equal((await req(`${path}?${periodo}`, "GET", undefined, empleado)).status, 403);
  for (const path of ["/dashboard/resumen?desde=2026-02-30&hasta=2026-03-01", "/auditoria?" + periodo + "&pagina=-1", "/auditoria?" + periodo + "&tabla='", "/dashboard/resumen?desde=2020-01-01&hasta=2026-01-01"]) assert.equal((await req(path)).status, 400);
  assert.equal((await req("/reportes/sprint4/desconocido?" + periodo)).status, 404);
  const missing = await req("/ruta-inexistente"); assert.equal(missing.status, 404); assert.ok(missing.data.mensaje);
});
test("compra y pago actualizan inventario, indicadores, alertas, reportes y auditoría", async () => {
  let r = await req("/compras", "POST", { idProveedor: proveedor, factura: "S4-001", clave: randomUUID(), pago: null, detalles: [{ idProducto: producto, cantidad: 3, costo: 2 }] });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  r = await req("/pedidos", "POST", { idCliente: cliente, descuento: 0, clave: randomUUID(), detalles: [{ idProducto: producto, cantidad: 6 }] });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const id = r.data.ID_PEDIDO;
  assert.equal((await req(`/pedidos/${id}/venta`, "POST", {})).status, 201);
  assert.equal((await req(`/pedidos/${id}/pagos`, "POST", { monto: 60, metodo: "EFECTIVO", clave: randomUUID() })).status, 201);
  // Deterministic reporting dates regardless of execution date.
  await c.execute("UPDATE pedidos SET fecha=TIMESTAMP '2026-10-29 23:59:59' WHERE id_pedido=:id", { id });
  await c.commit();
  r = await req("/dashboard/resumen?desde=2026-10-29&hasta=2026-10-29");
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.indicadores.VENTAS, 1); assert.equal(r.data.indicadores.TOTAL, 60);
  assert.equal(r.data.indicadores.TICKET_PROMEDIO, 60);
  assert.equal(r.data.productos[0].UNIDADES, 6);
  assert.equal(r.data.existencias.find(p => p.ID_PRODUCTO === producto).STOCK, 9);
  r = await req("/reportes/sprint4/inventario?" + periodo);
  assert.equal(r.status, 200); assert.equal(r.data.find(p => p.CODIGO === "S4").ALERTA, "REABASTECER");
  r = await req("/reportes/sprint4/compras?" + periodo); assert.equal(r.status, 200);
  r = await req("/auditoria?" + periodo); assert.equal(r.status, 200); assert.ok(r.data.total > 0);
});
test("cambios de catálogos se auditan y un error de auditoría revierte el cambio", async () => {
  let r = await req(`/inventario/${producto}/minimo`, "PATCH", { minimo: 20 });
  assert.equal(r.status, 200);
  const [registro] = await filas(c, "SELECT * FROM bitacora WHERE accion='MINIMO_ACTUALIZADO' AND id_registro_afectado=:id", { id: producto });
  assert.ok(registro.ID_USUARIO); assert.equal(registro.DETALLE, "Mínimo: 20");
  await c.rollback();
  r = await req(`/productos/${producto}/estado`, "PATCH", { estado: "I" });
  assert.equal(r.status, 200);
  assert.ok((await filas(c, "SELECT * FROM bitacora WHERE accion='PRODUCTO_ESTADO' AND id_registro_afectado=:id", { id: producto })).length);
  await c.rollback();
  // Only this isolated schema is modified. Force audit failure to prove atomicity.
  await c.execute("ALTER TABLE bitacora ADD CONSTRAINT prueba_s4 CHECK (accion<>'PRODUCTO_ESTADO') NOT VALID"); await c.commit();
  try {
    r = await req(`/productos/${producto}/estado`, "PATCH", { estado: "A" });
    assert.equal(r.status, 500);
    assert.equal((await filas(c, "SELECT estado FROM productos WHERE id_producto=:id", { id: producto }))[0].ESTADO, "I");
  } finally { await c.rollback(); await c.execute("ALTER TABLE bitacora DROP CONSTRAINT prueba_s4"); await c.commit(); }
});

test("auditoría filtra antes de paginar y valida entradas", async()=>{
  const actor=jwt.decode(admin).id;
  await c.execute("INSERT INTO bitacora(id_usuario,accion,tabla_afectada,id_registro_afectado,detalle,fecha_hora) SELECT :actor,'CLIENTE_CREADO','CLIENTES',n,'Filtro especial',TIMESTAMP '2026-10-29 12:00:00' FROM generate_series(1000,1050) n",{actor});await c.commit();
  let r=await req('/auditoria?'+periodo+'&tabla=CLIENTES&accion=CLIENTE_CREADO&usuario=s4admin');
  assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.total,51);assert.equal(r.data.registros.length,50);assert.equal(r.data.registros[0].ACTOR_NOMBRE,'Prueba');
  r=await req('/auditoria?'+periodo+'&tabla=CLIENTES&pagina=2');assert.equal(r.data.registros.length,1);
  r=await req('/auditoria?'+periodo+'&registro=1000&buscar=especial');assert.equal(r.data.total,1);
  r=await req('/auditoria?'+periodo+'&tabla=CLIENTES&buscar=%25');assert.equal(r.data.total,0);
  for(const filtro of ['registro=-1','accion=incorrecta','usuario='+ 'a'.repeat(101),'buscar=a&buscar=b']) assert.equal((await req('/auditoria?'+periodo+'&'+filtro)).status,400);
});

test("eliminar usuario conserva nombre y cuenta en el historial",async()=>{
  const id=await insertar("INSERT INTO usuarios(nombre_completo,nombre_usuario,contrasena_hash,id_rol) VALUES ('Ana López','ana_s4','NO_LOGIN',1) RETURNING id_usuario");await c.commit();
  const r=await req('/usuarios/'+id,'DELETE');assert.equal(r.status,200,JSON.stringify(r.data));
  const [b]=await filas(c,"SELECT detalle FROM bitacora WHERE accion='USUARIO_ELIMINADO' AND id_registro_afectado=:id",{id});
  assert.equal(JSON.parse(b.DETALLE).nombreCompleto,'Ana López');assert.equal(JSON.parse(b.DETALLE).nombreUsuario,'ana_s4');
  assert.equal((await filas(c,'SELECT id_usuario FROM usuarios WHERE id_usuario=:id',{id})).length,0);await c.rollback();
});
