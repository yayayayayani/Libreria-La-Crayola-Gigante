import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function iniciar(page, permisos = ["VENTAS_GESTIONAR", "DESCUENTOS_APLICAR", "PAGOS_REGISTRAR", "PEDIDOS_APROBAR", "REPORTES_VER", "BITACORA_VER", "CLIENTES_CREAR"], caja = false) {
  const estado = { pedido: null, pago: null, stock: 10 };
  await page.route("**/api/**", async (route) => {
    const r = route.request(), url = new URL(r.url()), path = url.pathname.replace("/api", "");
    const ok = (json, status = 200) => route.fulfill({ json, status });
    if (path === "/auth/login") return ok({ token: "prueba", usuario: { id: 1, nombre: "Prueba" } });
    if (path === "/auth/permisos") return ok({ permisos, usuario: { id: 1, idRol: 1, nombre: "Prueba" } });
    if (path === "/ventas/catalogo") return ok({ clientes: [{ ID_CLIENTE: 1, NOMBRES: "Ana", NIT: "12345678" }], productos: [{ ID_PRODUCTO: 1, NOMBRE: "Cuaderno", PRECIO: 10, STOCK: estado.stock }] });
    if (path === "/ventas/clientes" && r.method() === "POST") { estado.clienteNuevo = r.postDataJSON(); return ok({id:2},201); }
    if (path === "/pedidos" && r.method() === "POST") {
      estado.datos = r.postDataJSON();
      estado.pedido = { ID_PEDIDO: 1, ID_CLIENTE: estado.datos.idCliente, NOMBRES: "Ana", ESTADO: estado.datos.descuento > 10 ? "PENDIENTE_APROBACION" : "APROBADO", SUBTOTAL: 20, DESCUENTO: estado.datos.descuento, TOTAL: 20 * (1 - estado.datos.descuento / 100), PAGADO: 0 };
      estado.pedido.IVA_TASA = 12; estado.pedido.BASE_IMPONIBLE = Math.round(estado.pedido.TOTAL / 1.12 * 100) / 100; estado.pedido.IVA = Number((estado.pedido.TOTAL - estado.pedido.BASE_IMPONIBLE).toFixed(2));
      return ok({ ID_PEDIDO: 1, ...(caja ? { estado: estado.pedido.ESTADO } : {}) }, 201);
    }
    if (path === "/pedidos") return ok(estado.pedido ? [estado.pedido] : []);
    if (path === "/pedidos/1/venta") { estado.pedido.ESTADO = "VENDIDO"; return ok({ ID_VENTA: 1 }, 201); }
    if (path === "/pedidos/1/pagos") {
      estado.pago = r.postDataJSON(); estado.pedido.ESTADO = "PAGADO"; estado.pedido.PAGADO = estado.pago.monto + (estado.pago.puntos || 0) / 10; estado.pedido[estado.pago.metodo] = estado.pago.monto; estado.pedido.PUNTOS = (estado.pago.puntos || 0) / 10; estado.stock -= 2;
      return ok({ completo: !!estado.imprimir, mensaje: "Pago completo e inventario actualizado" }, 201);
    }
    if (path === "/pedidos/1/comprobante") return ok({ numero: "CV-00000001", negocio: "La Crayola Gigante", fecha: "2026-10-20T12:00:00Z", venta: { ...estado.pedido, CLIENTE_NOMBRE: "Consumidor Final", DOCUMENTO: "CF" }, detalles: [{ NOMBRE: "Cuaderno <especial>", CODIGO: "CUA", CANTIDAD: 2, PRECIO: 10 }], pagos: [{ MONTO: 20, METODO: "EFECTIVO", RECIBIDO: 25 }] });
    if (path === "/pedidos/1") return ok({ pedido: estado.pedido, puntosDisponibles: 100, movimientosPuntos: [], detalles: [{ NOMBRE: "Cuaderno", CANTIDAD: 2, PRECIO: 10 }], pagos: [], aprobaciones: [] });
    if (path === "/pedidos/1/decision") {
      estado.decision = r.postDataJSON(); estado.pedido.ESTADO = estado.decision.decision; return ok({ mensaje: "Decisión registrada" });
    }
    if (path.startsWith("/reportes/")) return ok([{ TOTAL: 20 }]);
    if (path === "/auditoria/sprint3") return ok([{ ACCION: "PAGO_REGISTRADO" }]);
    return ok({ mensaje: "Ruta no simulada" }, 404);
  });
  await page.goto("/");
  await page.locator("#usuario").fill("prueba"); await page.locator("#contrasena").fill("prueba");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("button", { name: /^Ventas a clientes/ }).click();
  return estado;
}
async function crear(page, descuento) {
  await page.getByRole("combobox", { name: "Cliente", exact: true }).selectOption("1");
  await page.getByRole("combobox", { name: "Producto", exact: true }).selectOption("1");
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  if (descuento !== undefined) await page.getByLabel("Descuento (%)", { exact: true }).fill(String(descuento));
  await page.getByRole("button", { name: "Continuar al cobro", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Pedido #1");
}
test("pedido, venta, pago, reportes y auditoría visibles", async ({ page }) => {
  const estado = await iniciar(page);
  await crear(page, 0);
  expect(estado.datos.detalles).toEqual([{ idProducto: 1, cantidad: 2 }]);
  await page.getByRole("button", { name: "Generar venta" }).click();
  await expect(page.getByRole("cell", { name: "Pendiente de pago", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver detalle" }).click();
  await page.getByLabel("Efectivo recibido (Q)").fill("25");
  await expect(page.getByText("Cambio: Q5.00")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByRole("status")).toContainText("inventario actualizado");
  expect(estado.pago.monto).toBe(20); expect(estado.stock).toBe(8);
  await page.getByRole("button", { name: "Reportes", exact: true }).click();
  await page.getByRole("button", { name: "Ventas por día", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ventas por día de pedido" })).toBeVisible();
  await page.getByRole("button", { name: "Productos vendidos", exact: true }).click();
  await expect(page.getByRole("heading", { name: /importe bruto/ })).toBeVisible();
  await page.getByRole("button", { name: "Consultar últimas 200 acciones" }).click();
  await expect(page.getByRole("cell", { name: "PAGO_REGISTRADO" })).toBeVisible();
});
test("descuento requiere decisión con motivo", async ({ page }) => {
  const estado = await iniciar(page); await crear(page, 20);
  await expect(page.getByRole("button", { name: "Generar venta" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver detalle" }).click();
  await expect(page.getByRole("button", { name: "Aprobar", exact: true })).toBeDisabled();
  await page.getByLabel("Motivo", { exact: true }).fill("Promoción autorizada");
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Generar venta" })).toBeVisible();
  expect(estado.decision.motivo).toBe("Promoción autorizada");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: "test-results/pedidos-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continuar al cobro", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/pedidos-mobile.png", fullPage: true });
});
test("rol de ventas no ve descuento, cobro, reportes ni auditoría", async ({ page }) => {
  await iniciar(page, ["VENTAS_GESTIONAR"]); await crear(page);
  await expect(page.getByLabel("Descuento (%)", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Auditoría" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ventas por día" })).toHaveCount(0);
  await page.getByRole("button", { name: "Generar venta" }).click();
  await page.getByRole("button", { name: "Ver detalle" }).click();
  await expect(page.getByRole("button", { name: "Confirmar cobro" })).toHaveCount(0);
});

test("caja abre al crear y combina puntos con tarjeta", async ({ page }) => {
  const estado = await iniciar(page, undefined, true);
  await page.getByRole("combobox", { name: "Cliente", exact: true }).selectOption("1");
  await page.getByRole("combobox", { name: "Producto", exact: true }).selectOption("1");
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Continuar al cobro" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel(/Usar puntos/).fill("100");
  await expect(page.getByLabel("Monto a cobrar (Q)")).toHaveValue("10.00");
  await page.getByRole("dialog").getByRole("combobox").selectOption("TARJETA");
  await page.getByLabel("Referencia", { exact: true }).fill("POS-123");
  await page.getByRole("button", { name: "Confirmar cobro", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(estado.pago).toMatchObject({ monto: 10, puntos: 100, metodo: "TARJETA", referencia: "POS-123" });
  const fila = page.getByRole("row").filter({ hasText: "#1" });
  await expect(fila).toContainText("Tarjeta: Q10.00");
  await expect(fila).toContainText("Puntos: Q10.00");
});
test("caja CF no ofrece puntos y calcula cambio en movil", async ({ page }) => {
  const estado = await iniciar(page, undefined, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("combobox", { name: "Producto", exact: true }).selectOption("1");
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Continuar al cobro" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel(/Usar puntos/)).toHaveCount(0);
  await page.getByLabel("Efectivo recibido (Q)").fill("50");
  await expect(page.getByText("Cambio: Q30.00")).toBeVisible();
  await page.screenshot({ path: "test-results/caja-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Confirmar cobro", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(estado.datos.idCliente).toBeNull();
  expect(estado.pago).toMatchObject({ puntos: 0, monto: 20, recibido: 50 });
});


test("IVA incluido se desglosa sin incrementar el total", async ({ page }) => {
  await iniciar(page, undefined, true);
  await page.getByRole("combobox", { name: "Producto", exact: true }).selectOption("1");
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  const resumen = page.locator(".pedidos-receipt");
  await expect(resumen).toContainText("Q17.86");
  await expect(resumen).toContainText("Q2.14");
  await expect(resumen.locator(".receipt-total")).toContainText("Q20.00");
  await page.getByRole("button", { name: "Continuar al cobro" }).click();
  await expect(page.locator(".caja-impuestos")).toContainText("Q2.14");
  await expect(page.getByLabel("Monto a cobrar (Q)")).toHaveValue("20.00");
});

test("comprobante automatico, dos copias e historial para reimprimir", async ({ page }) => {
  await page.addInitScript(() => { window.print = () => { window.__impresiones = (window.__impresiones || 0) + 1; }; });
  const estado = await iniciar(page, undefined, true); estado.imprimir = true;
  await page.getByRole("combobox", { name: "Producto", exact: true }).selectOption("1");
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Continuar al cobro" }).click();
  await page.getByLabel("Efectivo recibido (Q)").fill("25");
  await page.getByRole("button", { name: "Confirmar cobro", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Comprobante de venta", exact: true })).toBeVisible();
  const documento = page.frameLocator('iframe[title="Copias del comprobante"]');
  await expect(documento.getByText("Copia para el negocio", { exact: true })).toBeVisible();
  await expect(documento.getByText("Copia para el cliente", { exact: true })).toBeVisible();
  await expect(documento.getByRole("cell", { name: /Cuaderno <especial>/ })).toHaveCount(2);
  await expect(documento.getByText("Q2.14", { exact: true })).toHaveCount(2);
  const marco = page.frames().find(f => f !== page.mainFrame());
  await expect.poll(() => marco.evaluate(() => window.__impresiones)).toBe(1);
  const vistaPdf = await page.context().newPage();
  await vistaPdf.setContent(await marco.content());
  const pdf = await vistaPdf.pdf({ path: "test-results/comprobante-dos-copias.pdf", preferCSSPageSize: true });
  expect(pdf.toString("latin1")).toContain("/Count 2");
  await vistaPdf.screenshot({ path: "test-results/comprobante-vista.png", fullPage: true });
  await vistaPdf.close();
  await page.getByRole("button", { name: "Cerrar comprobante" }).click();
  await page.getByRole("button", { name: "Ver comprobante", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Comprobante de venta", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Imprimir / Guardar PDF" }).click();
});


test("NIT sin cuenta se envia con receptor y sin crear cliente",async({page})=>{
  const e=await iniciar(page);
  await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('1');
  await page.getByLabel('Cantidad',{exact:true}).fill('2');
  await page.getByRole('combobox',{name:'Cliente',exact:true}).selectOption('nit');
  await page.getByLabel('Nombre o razón social').fill('Comercio Uno');
  await page.getByLabel('NIT de la compra').fill('1234567-8');
  await page.getByRole('button',{name:'Continuar al cobro',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Pedido #1');
  expect(e.datos).toMatchObject({idCliente:null,receptor:{nombre:'Comercio Uno',nit:'1234567-8'},detalles:[{idProducto:1,cantidad:2}]});
  expect(e.clienteNuevo).toBeUndefined();
});
test("cliente nuevo se registra desde caja sin perder productos",async({page})=>{
  const e=await iniciar(page,["VENTAS_GESTIONAR"]);
  await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('1');
  await page.getByLabel('Cantidad',{exact:true}).fill('2');
  await page.getByRole('combobox',{name:'Cliente',exact:true}).selectOption('nuevo');
  await page.getByLabel('Nombre del cliente').fill('Ana Lopez');
  await page.getByLabel('NIT de la compra').fill('12345678');
  await page.getByRole('button',{name:'Continuar al cobro',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Pedido #1');
  expect(e.clienteNuevo).toMatchObject({nombres:'Ana Lopez',nit:'12345678'});
  expect(e.datos).toMatchObject({idCliente:2,receptor:null,detalles:[{idProducto:1,cantidad:2}]});
});
test("reporte descargable conserva filas y neutraliza formulas",async({page})=>{
  await iniciar(page);
  await page.route('**/api/reportes/sprint3/productos*',r=>r.fulfill({json:[{NOMBRE:'=1+1',UNIDADES:2,IMPORTE_BRUTO:20}]}));
  await page.getByRole('button',{name:'Reportes',exact:true}).click();
  await page.getByRole('button',{name:'Productos vendidos',exact:true}).click();
  await expect(page.getByRole('cell',{name:'=1+1',exact:true})).toBeVisible();
  const descarga=page.waitForEvent('download');
  await page.getByRole('button',{name:'Descargar CSV',exact:true}).click();
  const archivo=await descarga;
  expect(archivo.suggestedFilename()).toBe('reporte-productos.csv');
  const csv=await readFile(await archivo.path(),'utf8');expect(csv).toContain("\"'=1+1\"");expect(csv).toContain('"2","20"');
});


test("NIT duplicado al registrar cliente conserva formulario y carrito",async({page})=>{
  const e=await iniciar(page,['VENTAS_GESTIONAR']);
  await page.route('**/api/ventas/clientes',r=>r.fulfill({status:409,json:{mensaje:'El NIT ya está registrado'}}));
  await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('1');
  await page.getByRole('combobox',{name:'Cliente',exact:true}).selectOption('nuevo');
  await page.getByLabel('Nombre del cliente').fill('Ana Lopez');
  await page.getByLabel('NIT de la compra').fill('12345678');
  await page.getByRole('button',{name:'Continuar al cobro',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('NIT ya');
  await expect(page.getByLabel('Nombre del cliente')).toHaveValue('Ana Lopez');
  await expect(page.getByRole('combobox',{name:'Producto',exact:true})).toHaveValue('1');
  expect(e.pedido).toBeNull();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/cliente-caja-mobile.png',fullPage:true});
});
