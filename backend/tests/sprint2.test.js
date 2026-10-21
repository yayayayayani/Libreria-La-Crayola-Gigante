require("dotenv").config({ quiet: true });
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("node:crypto");
const { conectar, filas, idSalida } = require("../src/services/db");
const { nombreValido, nitValido, validarCompra } = require("../src/services/validaciones");
const app = require("../src/server");
let c,
  server,
  base,
  token,
  sinPermiso,
  proveedor,
  producto,
  inactivo,
  categoria,
  usuario,
  otroUsuario,
  rol;
const marca = `S2_${Date.now()}`,
  correo = `${marca.toLowerCase()}@example.invalid`;
async function insertar(sql, binds = {}) {
  const r = await c.execute(sql, { ...binds, id: idSalida() });
  return r.outBinds.id[0];
}
async function request(path, method = "GET", body, access = token) {
  const r = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const compra = (extra = {}) => ({
  idProveedor: proveedor,
  factura: randomUUID(),
  clave: randomUUID(),
  detalles: [{ idProducto: producto, cantidad: 3, costo: 2.25 }],
  ...extra,
});
const stock = async () =>
  (await filas(c, "SELECT stock FROM productos WHERE id_producto=:id", { id: producto }))[0].STOCK;

test("proveedor sin compras se puede eliminar; respeta permisos e inexistentes", async () => {
  const id = await insertar(
    "INSERT INTO proveedores(nombre,nit) VALUES (:nombre,:nit) RETURNING id_proveedor INTO :id",
    { nombre: marca + "_eliminar", nit: String(Date.now()) + "9" },
  );
  await c.commit();
  try {
    assert.equal(
      (await request(`/proveedores/${id}`, "DELETE", undefined, sinPermiso)).status,
      403,
    );
    assert.equal(
      (await request(`/proveedores/${id}/estado`, "PATCH", { estado: "I" }, sinPermiso)).status,
      403,
    );
    assert.equal(
      (await request(`/proveedores/${id}/estado`, "PATCH", { estado: "I" })).status,
      200,
    );
    assert.equal((await request(`/proveedores/${id}`, "DELETE")).status, 200);
    assert.equal((await request(`/proveedores/${id}`, "DELETE")).status, 404);
  } finally {
    await c.execute("DELETE FROM proveedores WHERE id_proveedor=:id", { id });
    await c.commit();
  }
});

test("14 fotografía se guarda, consulta con permiso y conserva al editar sin imagen", async () => {
  const sharp = require("sharp");
  const bytes = await sharp({
    create: { width: 12, height: 12, channels: 3, background: "#cc9900" },
  })
    .png()
    .toBuffer();
  const datos = {
    codigo: marca,
    nombre: "Prueba producto",
    descripcion: "Foto",
    precio: 5,
    stock: 0,
    idCategoria: categoria,
  };
  let r = await request(`/productos/${producto}`, "PUT", {
    ...datos,
    imagen: `data:image/png;base64,${bytes.toString("base64")}`,
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  let foto = await fetch(`${base}/productos/${producto}/imagen`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(foto.status, 200);
  assert.match(foto.headers.get("content-type"), /image\/webp/);
  assert.ok((await foto.arrayBuffer()).byteLength > 0);
  assert.equal(
    (
      await fetch(`${base}/productos/${producto}/imagen`, {
        headers: { Authorization: `Bearer ${sinPermiso}` },
      })
    ).status,
    403,
  );
  r = await request(`/productos/${producto}`, "PUT", datos);
  assert.equal(r.status, 200);
  assert.equal(
    (
      await filas(c, "SELECT id_producto FROM imagenes_productos WHERE id_producto=:id", {
        id: producto,
      })
    ).length,
    1,
  );
});
test("15 imagen inválida revierte edición y quitar imagen conserva producto", async () => {
  const datos = {
    codigo: marca,
    nombre: "Nombre incorrecto",
    precio: 5,
    stock: 0,
    idCategoria: categoria,
    imagen: "data:image/png;base64,aG9sYQ==",
  };
  assert.equal((await request(`/productos/${producto}`, "PUT", datos)).status, 400);
  assert.equal(
    (await filas(c, "SELECT nombre FROM productos WHERE id_producto=:id", { id: producto }))[0]
      .NOMBRE,
    "Prueba producto",
  );
  assert.equal(
    (
      await request(`/productos/${producto}`, "PUT", {
        ...datos,
        nombre: "Prueba producto",
        imagen: null,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(`${base}/productos/${producto}/imagen`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status,
    204,
  );
});
test("16 stock inicial rechaza booleanos y valores mayores al límite del inventario", async () => {
  for (const valor of [true, 10000000000, " ", []]) {
    assert.equal(
      (
        await request("/productos", "POST", {
          codigo: marca + "_limite",
          nombre: "Prueba límite",
          precio: 5,
          stock: valor,
          idCategoria: categoria,
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await request("/productos", "POST", {
        codigo: marca + "_limite",
        nombre: "Prueba límite",
        precio: [5],
        stock: 0,
        idCategoria: categoria,
      })
    ).status,
    400,
  );
});
before(async () => {
  c = await conectar();
  rol = await insertar("INSERT INTO roles(nombre) VALUES (:nombre) RETURNING id_rol INTO :id", {
    nombre: marca,
  });
  usuario = await insertar(
    "INSERT INTO usuarios(nombre_completo,nombre_usuario,contrasena_hash,id_rol,correo) VALUES ('Prueba Sprint',:nombre,'SIN_LOGIN',1,:correo) RETURNING id_usuario INTO :id",
    { nombre: marca, correo },
  );
  otroUsuario = await insertar(
    "INSERT INTO usuarios(nombre_completo,nombre_usuario,contrasena_hash,id_rol) VALUES ('Prueba Sin Permisos',:nombre,'SIN_LOGIN',:rol) RETURNING id_usuario INTO :id",
    { nombre: marca + "_otro", rol },
  );
  categoria = await insertar(
    "INSERT INTO categorias(nombre) VALUES (:nombre) RETURNING id_categoria INTO :id",
    { nombre: marca },
  );
  producto = await insertar(
    "INSERT INTO productos(codigo,nombre,precio,stock,id_categoria) VALUES (:nombre,'Prueba producto',5,10,:categoria) RETURNING id_producto INTO :id",
    { nombre: marca, categoria },
  );
  inactivo = await insertar(
    "INSERT INTO productos(codigo,nombre,precio,stock,id_categoria,estado) VALUES (:nombre,'Prueba inactiva',5,0,:categoria,'I') RETURNING id_producto INTO :id",
    { nombre: marca + "_I", categoria },
  );
  proveedor = await insertar(
    "INSERT INTO proveedores(nombre,nit) VALUES (:nombre,:nit) RETURNING id_proveedor INTO :id",
    { nombre: marca, nit: String(Date.now()) },
  );
  await c.commit();
  token = jwt.sign({ id: usuario }, process.env.JWT_SECRET, { expiresIn: "5m" });
  sinPermiso = jwt.sign({ id: otroUsuario }, process.env.JWT_SECRET, { expiresIn: "5m" });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (c) {
    // Eliminar exclusivamente registros de esta ejecución; no toca datos del usuario.
    await c.execute("DELETE FROM movimientos_inventario WHERE id_producto IN (:p,:i)", {
      p: producto || -1,
      i: inactivo || -1,
    });
    await c.execute(
      "DELETE FROM detalle_ventas WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_usuario=:id)",
      { id: usuario || -1 },
    );
    await c.execute("DELETE FROM ventas WHERE id_usuario=:id", { id: usuario || -1 });
    await c.execute("DELETE FROM clientes WHERE correo=:correo", {
      correo: marca.toLowerCase() + "cliente@example.invalid",
    });
    await c.execute(
      "DELETE FROM recuperaciones_compra WHERE id_compra IN (SELECT id_compra FROM compras WHERE id_proveedor=:id)",
      { id: proveedor || -1 },
    );
    await c.execute(
      "DELETE FROM detalle_compras WHERE id_compra IN (SELECT id_compra FROM compras WHERE id_proveedor=:id)",
      { id: proveedor || -1 },
    );
    await c.execute(
      "DELETE FROM recepciones WHERE id_compra IN (SELECT id_compra FROM compras WHERE id_proveedor=:id)",
      { id: proveedor || -1 },
    );
    await c.execute("DELETE FROM compras WHERE id_proveedor=:id", { id: proveedor || -1 });
    await c.execute("DELETE FROM proveedores WHERE id_proveedor=:id", { id: proveedor || -1 });
    await c.execute("DELETE FROM productos WHERE id_categoria=:id", { id: categoria || -1 });
    await c.execute("DELETE FROM categorias WHERE id_categoria=:id", { id: categoria || -1 });
    await c.execute("DELETE FROM correos_pendientes WHERE destinatario=:correo", { correo });
    await c.execute("DELETE FROM usuarios WHERE id_usuario IN (:u,:o)", {
      u: usuario || -1,
      o: otroUsuario || -1,
    });
    await c.execute("DELETE FROM roles WHERE id_rol=:id", { id: rol || -1 });
    await c.commit();
    await c.close();
  }
});
test("01 compra genera detalle, recepción, movimiento y suma stock", async () => {
  const r = await request("/compras", "POST", compra());
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.total, 6.75);
  assert.equal(await stock(), 13);
  const d = await request(`/compras/${r.data.id}`);
  assert.equal(d.data.detalles.length, 1);
  assert.equal(d.data.recepcion.ID_COMPRA, r.data.id);
  const m = await filas(c, "SELECT * FROM movimientos_inventario WHERE id_recepcion=:id", {
    id: d.data.recepcion.ID_RECEPCION,
  });
  assert.equal(m.length, 1);
  assert.equal(m[0].STOCK_ANTERIOR, 10);
  assert.equal(m[0].STOCK_NUEVO, 13);
});
test("02 factura duplicada y reintento no duplican inventario", async () => {
  const datos = compra();
  assert.equal((await request("/compras", "POST", datos)).status, 201);
  const antes = await stock();
  assert.equal((await request("/compras", "POST", datos)).status, 409);
  assert.equal((await request("/compras", "POST", { ...datos, clave: randomUUID() })).status, 409);
  assert.equal(await stock(), antes);
});
test("03 rechaza cantidades negativas, cero, fracciones y costo inválido", async () => {
  for (const d of [
    { cantidad: 0, costo: 1 },
    { cantidad: -2, costo: 1 },
    { cantidad: 1.5, costo: 1 },
    { cantidad: 1, costo: -1 },
    { cantidad: 1, costo: 1.123 },
  ])
    assert.equal(
      (await request("/compras", "POST", compra({ detalles: [{ idProducto: producto, ...d }] })))
        .status,
      400,
    );
});
test("04 producto inactivo y detalle repetido no alteran stock", async () => {
  const antes = await stock();
  assert.equal(
    (
      await request(
        "/compras",
        "POST",
        compra({
          detalles: [
            { idProducto: producto, cantidad: 2, costo: 1 },
            { idProducto: inactivo, cantidad: 1, costo: 1 },
          ],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/compras",
        "POST",
        compra({
          detalles: [
            { idProducto: producto, cantidad: 2, costo: 1 },
            { idProducto: producto, cantidad: 1, costo: 1 },
          ],
        }),
      )
    ).status,
    400,
  );
  assert.equal(await stock(), antes);
});
test("05 dos compras simultáneas conservan ambas entradas", async () => {
  const antes = await stock();
  const resultados = await Promise.all([
    request("/compras", "POST", compra()),
    request("/compras", "POST", compra()),
  ]);
  assert.deepEqual(
    resultados.map((r) => r.status),
    [201, 201],
  );
  assert.equal(await stock(), antes + 6);
});
test("06 alerta por debajo del mínimo y se resuelve al recibir", async () => {
  const actual = await stock();
  assert.equal(
    (await request(`/inventario/${producto}/minimo`, "PATCH", { minimo: actual + 1 })).status,
    200,
  );
  let r = await request("/inventario");
  assert.equal(r.data.find((p) => p.ID_PRODUCTO === producto).ALERTA, 1);
  await request("/compras", "POST", compra());
  r = await request("/inventario");
  assert.equal(r.data.find((p) => p.ID_PRODUCTO === producto).ALERTA, 0);
  assert.equal(
    (await request(`/inventario/${producto}/minimo`, "PATCH", { minimo: -1 })).status,
    400,
  );
});

test("recepción registra daños y solo incorpora las unidades aceptadas", async () => {
  const antes = await stock();
  const datos = compra({ detalles: [
    { idProducto: producto, cantidad: 80, costo: 2, cantidadDanada: 10, observaciones: "Lápices rotos" },
  ] });
  const r = await request("/compras", "POST", datos);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(await stock(), antes + 70);
  const detalle = (await request(`/compras/${r.data.id}`)).data;
  assert.equal(detalle.detalles[0].CANTIDAD_DANADA, 10);
  assert.equal(detalle.detalles[0].OBSERVACIONES, "Lápices rotos");
  assert.equal(detalle.compra.TOTAL, 160);
  const movimientos = await filas(c, "SELECT * FROM movimientos_inventario WHERE id_recepcion=:id",
    { id: detalle.recepcion.ID_RECEPCION });
  assert.equal(movimientos[0].CANTIDAD, 70);
  assert.equal(movimientos[0].STOCK_NUEVO, antes + 70);
  assert.equal((await request("/compras", "POST", datos)).status, 409);
  assert.equal(await stock(), antes + 70);
  const rechazadas = await request("/compras", "POST", compra({ detalles: [
    { idProducto: producto, cantidad: 80, costo: 2, cantidadDanada: 80 },
  ] }));
  assert.equal(rechazadas.status, 201);
  assert.equal(await stock(), antes + 70);
});

test("mínimo no admite cero; alerta en 9 y 0 pero no en 10", async () => {
  const antes = await stock();
  try {
    assert.equal((await request(`/inventario/${producto}/minimo`, "PATCH", { minimo: 0 })).status, 400);
    assert.equal((await request(`/inventario/${producto}/minimo`, "PATCH", { minimo: 10 })).status, 200);
    for (const [cantidad, alerta] of [[10, 0], [9, 1], [0, 1]]) {
      await c.execute("UPDATE productos SET stock=:cantidad WHERE id_producto=:id", { cantidad, id: producto });
      await c.commit();
      const r = await request("/inventario");
      assert.equal(r.data.find((p) => p.ID_PRODUCTO === producto).ALERTA, alerta);
    }
  } finally {
    await c.execute("UPDATE productos SET stock=:cantidad WHERE id_producto=:id", { cantidad: antes, id: producto });
    await c.commit();
  }
});
test("07 autorización en todos los endpoints nuevos", async () => {
  for (const ruta of [
    "/compras",
    "/proveedores",
    "/inventario",
    "/movimientos",
    "/catalogo-compras",
  ])
    assert.equal((await request(ruta, "GET", undefined, sinPermiso)).status, 403);
  assert.equal((await request("/compras", "POST", compra(), sinPermiso)).status, 403);
  assert.equal((await request("/inventario", "GET", undefined, "invalido")).status, 401);
});
test("08 nombres personales sin números, admite tildes y guiones", async () => {
  assert.ok(nombreValido("María José"));
  assert.ok(nombreValido("Ana-María"));
  assert.equal(nombreValido("David123"), false);
  assert.equal((await request("/clientes", "POST", { nombres: "Pedro123" })).status, 400);
  assert.equal(
    (
      await request("/usuarios", "POST", {
        nombreCompleto: "Pedro123",
        nombreUsuario: marca + "_nuevo",
        correo,
        contrasena: "PruebaLarga123",
        idRol: 1,
      })
    ).status,
    400,
  );
});
test("09 NIT tradicional y CUI de 13 dígitos; rechaza letras arbitrarias", () => {
  assert.ok(nitValido("1234567K"));
  assert.ok(nitValido("1234567-K"));
  assert.ok(nitValido("1234567890123"));
  assert.equal(nitValido("123ABC"), false);
  assert.equal(nitValido("12345678901234"), false);
});
test("10 correo duplicado sin distinguir mayúsculas devuelve 409 y encola aviso", async () => {
  const r = await request("/usuarios", "POST", {
    nombreCompleto: "Usuario Prueba",
    nombreUsuario: marca + "_dup",
    correo: correo.toUpperCase(),
    contrasena: "PruebaLarga123",
    idRol: 1,
  });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  const avisos = await filas(
    c,
    "SELECT * FROM correos_pendientes WHERE destinatario=:correo AND asunto='Intento de reutilización de correo'",
    { correo },
  );
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].ESTADO, "PENDIENTE");
  await request("/usuarios", "POST", {
    nombreCompleto: "Usuario Prueba",
    nombreUsuario: marca + "_dup",
    correo,
    contrasena: "PruebaLarga123",
    idRol: 1,
  });
  assert.equal(
    (await filas(c, "SELECT * FROM correos_pendientes WHERE destinatario=:correo", { correo }))
      .length,
    1,
  );
});
test("11 editar producto no sobrescribe saldo de compras con stock obsoleto", async () => {
  const antes = await stock();
  const r = await request(`/productos/${producto}`, "PUT", {
    codigo: marca,
    nombre: "Prueba producto",
    descripcion: "Prueba",
    precio: 5,
    stock: 0,
    idCategoria: categoria,
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(await stock(), antes);
});
test("12 total se calcula con centavos y no confía en total recibido", () => {
  assert.equal(
    validarCompra(compra({ detalles: [{ idProducto: 1, cantidad: 3, costo: 0.1 }], total: 999 }))
      .total,
    0.3,
  );
  assert.throws(() => validarCompra(compra({ detalles: [] })));
});
test("13 cola conserva fallos y entrega mediante SMTP local de prueba", async () => {
  const net = require("node:net"),
    nodemailer = require("nodemailer");
  const { procesarCorreos } = require("../src/services/correos");
  const id = (
    await filas(c, "SELECT id_correo FROM correos_pendientes WHERE destinatario=:correo", {
      correo,
    })
  )[0].ID_CORREO;
  await procesarCorreos(
    {
      sendMail: async () => {
        const e = new Error("Fallo simulado");
        e.code = "ECONNECTION";
        throw e;
      },
    },
    id,
  );
  let fila = (await filas(c, "SELECT * FROM correos_pendientes WHERE id_correo=:id", { id }))[0];
  assert.equal(fila.ESTADO, "PENDIENTE");
  assert.equal(fila.INTENTOS, 1);
  let contenido = "";
  const smtp = net.createServer((socket) => {
    socket.setEncoding("utf8");
    socket.write("220 localhost ESMTP test\r\n");
    let buffer = "",
      datos = false;
    socket.on("data", (chunk) => {
      buffer += chunk;
      let pos;
      while ((pos = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, pos);
        buffer = buffer.slice(pos + 2);
        if (datos) {
          if (line === ".") {
            datos = false;
            socket.write("250 Accepted\r\n");
          } else contenido += line + "\n";
        } else if (/^EHLO|^HELO/.test(line)) socket.write("250 localhost\r\n");
        else if (/^DATA/.test(line)) {
          datos = true;
          socket.write("354 End with dot\r\n");
        } else if (/^QUIT/.test(line)) socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  const previo = process.env.SMTP_FROM;
  process.env.SMTP_FROM = "pruebas@example.invalid";
  const transport = nodemailer.createTransport({
    host: "127.0.0.1",
    port: smtp.address().port,
    secure: false,
    ignoreTLS: true,
  });
  try {
    const r = await procesarCorreos(transport, id);
    assert.equal(r.enviados, 1);
    assert.match(contenido, /Message-ID: <crayola-/i);
    assert.ok(contenido.includes(correo));
    fila = (await filas(c, "SELECT * FROM correos_pendientes WHERE id_correo=:id", { id }))[0];
    assert.equal(fila.ESTADO, "ENVIADO");
    assert.equal(fila.INTENTOS, 2);
    assert.equal(fila.ULTIMO_ERROR, null);
  } finally {
    transport.close();
    if (previo === undefined) delete process.env.SMTP_FROM;
    else process.env.SMTP_FROM = previo;
    await new Promise((resolve) => smtp.close(resolve));
  }
});

// Las ventas completas se prueban en sprint3.test.js; el acceso antiguo queda cerrado.
test("ventas: ruta directa bloqueada y catálogo protegido", async () => {
  const antes = await stock();
  for (const modo of ["cf", "nuevo", "existente"])
    assert.equal((await request("/ventas", "POST", { modo, clave: randomUUID(), detalles: [{ idProducto: producto, cantidad: 1 }] })).status, 409);
  assert.equal(await stock(), antes);
  assert.equal((await request("/ventas", "POST", {}, sinPermiso)).status, 403);
  assert.equal((await request("/ventas/catalogo", "GET", undefined, sinPermiso)).status, 403);
});
test("proveedores: nombre comercial libre y NIT de ocho caracteres con guion", async () => {
  const r = await request(`/proveedores/${proveedor}`, "PUT", {
    nombre: "1",
    nit: "1234567-8",
    tipoDocumento: "NIT",
    estado: "A",
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(
    (
      await request(`/proveedores/${proveedor}`, "PUT", {
        nombre: "Comercio #123 & Cía.",
        nit: "123",
        tipoDocumento: "DPI",
        estado: "A",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/proveedores/${proveedor}`, "PUT", {
        nombre: "Comercio #123 & Cía.",
        nit: "12--3",
        tipoDocumento: "NIT",
        estado: "A",
      })
    ).status,
    400,
  );
});

test("proveedor con compras conserva historial y permite desactivar", async () => {
  assert.equal((await request(`/proveedores/${proveedor}`, "DELETE")).status, 409);
  assert.equal(
    (await request(`/proveedores/${proveedor}/estado`, "PATCH", { estado: "I" })).status,
    200,
  );
  assert.equal(
    (await filas(c, "SELECT estado FROM proveedores WHERE id_proveedor=:id", { id: proveedor }))[0]
      .ESTADO,
    "I",
  );
  assert.ok(
    (await filas(c, "SELECT id_compra FROM compras WHERE id_proveedor=:id", { id: proveedor }))
      .length,
  );
  assert.equal((await request("/compras", "POST", compra())).status, 400);
  assert.equal(
    (await request(`/proveedores/${proveedor}/estado`, "PATCH", { estado: "A" })).status,
    200,
  );
});

test("rechazos conservan saldo y evidencia de créditos, reembolsos y pérdidas sin duplicar", async () => {
  const r = await request("/compras", "POST", compra({ detalles: [
    { idProducto: producto, cantidad: 5, costo: 10.65, cantidadDanada: 1 },
  ] }));
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const ruta = `/compras/${r.data.id}`;
  const resolver = (tipo, monto, referencia = randomUUID()) => ({
    tipo, monto, referencia, fechaDocumento: "2026-10-19", observaciones: "Documento de prueba", clave: randomUUID(),
  });
  let detalle = (await request(ruta)).data;
  assert.equal(detalle.saldoRechazos.pendiente, 10.65);
  const datos = resolver("NOTA_CREDITO", 3);
  assert.equal((await request(`${ruta}/recuperaciones`, "POST", datos, sinPermiso)).status, 403);
  assert.equal((await request(`${ruta}/recuperaciones`, "POST", datos)).status, 201);
  assert.equal((await request(`${ruta}/recuperaciones`, "POST", datos)).status, 200);
  assert.equal((await request(`${ruta}/recuperaciones`, "POST", { ...datos, clave: randomUUID() })).status, 409);
  assert.equal((await request(`${ruta}/recuperaciones`, "POST", resolver("REEMBOLSO", 2))).status, 201);
  assert.equal((await request(`${ruta}/recuperaciones`, "POST", { ...resolver("PERDIDA", 1), observaciones: "" })).status, 400);
  assert.equal((await request(`${ruta}/recuperaciones`, "POST", resolver("PERDIDA", 1))).status, 201);
  detalle = (await request(ruta)).data;
  assert.deepEqual(detalle.saldoRechazos, { rechazado: 10.65, acreditado: 3, reembolsado: 2, perdida: 1, pendiente: 4.65 });
  assert.equal(detalle.recuperaciones.length, 3);
  assert.equal(detalle.recuperaciones[0].REFERENCIA, datos.referencia.toUpperCase());
  assert.ok(detalle.recuperaciones[0].REGISTRADO_POR);
  const simultaneas = await Promise.all([
    request(`${ruta}/recuperaciones`, "POST", resolver("REEMBOLSO", 4.65)),
    request(`${ruta}/recuperaciones`, "POST", resolver("NOTA_CREDITO", 4.65)),
  ]);
  assert.deepEqual(simultaneas.map((x) => x.status).sort(), [201, 409]);
  detalle = (await request(ruta)).data;
  assert.equal(detalle.saldoRechazos.pendiente, 0);
  assert.equal(detalle.compra.TOTAL, 53.25);
  assert.equal(detalle.recuperaciones.length, 4);
  assert.equal((await request(`${ruta}/recuperaciones`, "POST", resolver("REEMBOLSO", 0.01))).status, 409);
  const listado = (await request("/compras")).data.find((x) => x.ID_COMPRA === r.data.id);
  assert.equal(listado.PENDIENTE_RECUPERAR, 0);
});
