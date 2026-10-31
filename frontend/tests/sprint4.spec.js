import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function iniciar(page, { empleado = false, fallo = false, vacio = false } = {}) {
  const consultas = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url()), path = url.pathname.replace("/api", "");
    consultas.push(path + url.search);
    const ok = json => route.fulfill({ json });
    if (path === "/auth/login") return ok({ token: "test", usuario: {} });
    if (path === "/auth/permisos") return ok({ usuario: { id: 1, nombre: "Equipo", idRol: empleado ? 2 : 1, rol: empleado ? "Empleado" : "Administrador" }, permisos: ["REPORTES_VER", "BITACORA_VER", "INVENTARIO_VER"] });
    if (path === "/empleado/mi-carnet") return ok({ empleado: { NOMBRE_COMPLETO: "Equipo" }, resumen: {}, ventas: [] });
    if (path === "/finanzas/compras-pendientes") return ok([]);
    if (path === "/finanzas/resumen") return ok({ totales: {}, porMetodo: [], porDia: [], movimientos: [], totalMovimientos: 0 });
    if (path === "/dashboard/resumen") {
      if (fallo) return route.fulfill({ status: 500, json: { mensaje: "Resumen temporalmente no disponible" } });
      return ok({ indicadores: { VENTAS: 3, TOTAL: 150, TICKET_PROMEDIO: 50 }, operacion: { PRODUCTOS_ACTIVOS: 10, CLIENTES_ACTIVOS: 8, PEDIDOS_PENDIENTES: 2, VENTAS_PENDIENTES: 1 }, ventasPorDia: vacio ? [] : [{ DIA: "2026-10-27", TOTAL: 90, VENTAS: 2 }, { DIA: "2026-10-29", TOTAL: 60, VENTAS: 1 }], productos: vacio ? [] : [{ CODIGO: "LAP", NOMBRE: "Lápices", UNIDADES: 15 }, { CODIGO: "COL", NOMBRE: "Colores", UNIDADES: 5 }], existencias: [{ ID_PRODUCTO: 1, NOMBRE: "Lápices", STOCK: 2, STOCK_MINIMO: 10 }] });
    }
    if (path === "/reportes/sprint4/inventario") return ok([{ CODIGO: "LAP", NOMBRE: "=1+1", STOCK: 2 }]);
    if (path === "/auditoria") return ok({ total: 51, pagina: Number(url.searchParams.get("pagina")), registros: [{ ID_BITACORA: 1, FECHA_HORA: "2026-10-29T18:00:00Z", ACTOR: "admin", ACCION: "PRODUCTO_CREADO", TABLA_AFECTADA: "PRODUCTOS", ID_REGISTRO_AFECTADO: 1, DETALLE: "Registro creado" }] });
    return ok([]);
  });
  await page.goto("/"); await page.locator("#usuario").fill("test"); await page.locator("#contrasena").fill("test");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Hola, Equipo" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Resumen operativo" })).toHaveCount(0);
  expect(consultas.some(u => u.startsWith("/dashboard/resumen"))).toBe(false);
  if (!empleado) await page.getByRole("button", { name: /^Dashboard/ }).click();
  return consultas;
}
test("indicadores, gráficas y alertas con filtros; CSV seguro y auditoría paginada", async ({ page }) => {
  const consultas = await iniciar(page), panel = page.getByRole("region", { name: "Resumen operativo" });
  await expect(panel.getByText("Ventas pagadas", { exact: true })).toBeVisible();
  await expect(panel.getByRole("figure", { name: "Ventas por día" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Producto por reabastecer", exact: true })).toBeVisible();
  await panel.getByLabel("Desde (operación)").fill("2026-10-01"); await panel.getByLabel("Hasta (operación)").fill("2026-10-29");
  await panel.getByRole("button", { name: "Aplicar período" }).click();
  await expect.poll(() => consultas.some(u => u.includes("/dashboard/resumen?desde=2026-10-01&hasta=2026-10-29"))).toBe(true);
  await panel.getByRole("button", { name: "Reportes", exact: true }).click();
  await panel.getByRole("button", { name: "Consultar reporte", exact: true }).click();
  await expect(panel.getByRole("cell", { name: "=1+1", exact: true })).toBeVisible();
  const download = page.waitForEvent("download"); await panel.getByRole("button", { name: "Descargar reporte CSV" }).click();
  expect(await readFile(await (await download).path(), "utf8")).toContain("'=1+1");
  await page.emulateMedia({ media: "print" });
  await expect(panel.getByRole("cell", { name: "=1+1", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mi dinero", exact: true })).toBeHidden();
  await expect(panel.getByRole("button", { name: "Descargar reporte CSV" })).toBeHidden();
  await page.screenshot({ path: "test-results/sprint4-impresion.png", fullPage: true });
  await page.emulateMedia({ media: "screen" });
  await panel.getByRole("button", { name: "Auditoría", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Producto registrado", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Más eventos" }).click();
  await expect.poll(() => consultas.some(u => u.includes("/auditoria?") && u.includes("pagina=2"))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/sprint4-mobile.png", fullPage: true });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(panel.getByText("Ventas pagadas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Dashboard/ })).toBeVisible();
});
test("empleado no consulta datos administrativos aunque conserve permisos antiguos", async ({ page }) => {
  const consultas = await iniciar(page, { empleado: true });
  await expect(page.getByRole("heading", { name: "Hola, Equipo" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Resumen operativo" })).toHaveCount(0);
  expect(consultas.some(u => u.startsWith("/dashboard") || u.startsWith("/auditoria"))).toBe(false);
});
test("un fallo ofrece reintento y un rango invertido no envía otra consulta", async ({ page }) => {
  const consultas = await iniciar(page, { fallo: true }), panel = page.getByRole("region", { name: "Resumen operativo" });
  await expect(panel.getByRole("alert")).toHaveText("Resumen temporalmente no disponible");
  const antes = consultas.filter(u => u.startsWith("/dashboard/resumen")).length;
  await panel.getByLabel("Desde (operación)").fill("2026-11-01"); await panel.getByLabel("Hasta (operación)").fill("2026-10-01");
  await panel.getByRole("button", { name: "Aplicar período" }).click();
  await expect(panel.getByRole("alert")).toContainText("rango válido");
  expect(consultas.filter(u => u.startsWith("/dashboard/resumen")).length).toBe(antes);
  await panel.getByRole("button", { name: "Actualizar resumen" }).click();
  await expect.poll(() => consultas.filter(u => u.startsWith("/dashboard/resumen")).length).toBe(antes + 1);
});

test("estilos interactivos, medida, ayuda y preferencias; vista móvil sin desbordamiento", async ({ page }) => {
  await iniciar(page);
  const panel = page.getByRole("region", { name: "Resumen operativo" });
  await panel.getByLabel("Desde (operación)").fill("2026-10-27");
  await panel.getByLabel("Hasta (operación)").fill("2026-10-29");
  await panel.getByRole("button", { name: "Aplicar período" }).click();
  const ventas = panel.getByRole("figure", { name: "Ventas por día", exact: true });
  const productos = panel.getByRole("figure", { name: "Productos más vendidos", exact: true });
  await expect(ventas.getByText("Cómo leer esta gráfica", { exact: true })).toBeVisible();
  await expect(productos.getByText("Lápices", { exact: true }).first()).toBeVisible();
  for (const estilo of ["Área", "Columnas", "Líneas"]) {
    await ventas.getByRole("button", { name: estilo, exact: true }).click();
    await expect(ventas.getByRole("button", { name: estilo, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  const punto = ventas.locator("circle[role=button]").first();
  await punto.focus(); await page.keyboard.press("Enter");
  await expect(ventas.locator(".grafica-detalle")).toContainText("90.00");
  await ventas.getByRole("button", { name: "Tabla", exact: true }).click();
  await expect(ventas.getByRole("row", { name: /2026-10-28/ })).toContainText("0.00");
  await ventas.getByLabel("Medida").selectOption("VENTAS");
  await expect(ventas.getByRole("row", { name: /2026-10-27/ })).toContainText("2");
  await productos.getByRole("button", { name: "Dona", exact: true }).click();
  await expect(productos.getByText("75.0%", { exact: true })).toBeVisible();
  await productos.locator(".grafica-dona li button").first().click();
  await expect(productos.locator(".grafica-detalle")).toContainText("15 unidades");
  await expect(productos.getByText(/no representan todas las ventas/)).toBeVisible();
  await productos.getByRole("button", { name: "Columnas", exact: true }).click();
  await expect(productos.getByRole("button", { name: /Lápices, Código LAP/ })).toBeVisible();
  await productos.getByRole("button", { name: "Tabla", exact: true }).click();
  await expect(productos.getByRole("row", { name: /Lápices LAP 15/ })).toBeVisible();
  await panel.getByRole("button", { name: "Vista amplia", exact: true }).click();
  await panel.getByRole("button", { name: "Cómo usar el dashboard", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Empieza por aquí" })).toBeVisible();
  await page.reload();
  await expect(panel.getByRole("button", { name: "Vista amplia", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(ventas.getByRole("button", { name: "Tabla", exact: true })).toHaveAttribute("aria-pressed", "true");
  await ventas.getByLabel("Medida").selectOption("TOTAL");
  await ventas.getByRole("button", { name: "Área", exact: true }).click();
  await productos.getByRole("button", { name: "Barras", exact: true }).click();
  await panel.getByRole("button", { name: "En tarjetas", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/dashboard-redesign-desktop.png", fullPage: true });
  await panel.locator(".operativo-graficas").screenshot({ path: "test-results/dashboard-redesign-charts.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(() => ventas.locator(".grafica-lienzo").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: "test-results/dashboard-redesign-mobile.png", fullPage: true });
});

test("períodos rápidos y estado vacío explicativo", async ({ page }) => {
  const consultas = await iniciar(page, { vacio: true });
  const panel = page.getByRole("region", { name: "Resumen operativo" });
  await expect(panel.getByText("Aún no hay ventas pagadas en este período", { exact: true })).toHaveCount(2);
  const antes = consultas.filter(u => u.startsWith("/dashboard/resumen")).length;
  await panel.getByRole("button", { name: "Últimos 7 días", exact: true }).click();
  await expect.poll(() => consultas.filter(u => u.startsWith("/dashboard/resumen")).length).toBe(antes + 1);
  const url = new URL("http://prueba" + consultas.filter(u => u.startsWith("/dashboard/resumen")).at(-1));
  expect((Date.parse(url.searchParams.get("hasta")) - Date.parse(url.searchParams.get("desde"))) / 86400000).toBe(6);
  await expect(panel.getByRole("button", { name: "Últimos 7 días", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("reportes con quetzales, filtros y descarga de resultados visibles", async ({page}) => {
  await iniciar(page);
  await page.route('**/api/reportes/sprint4/compras*', r => r.fulfill({json:[
    {ID_COMPRA:107,FECHA:'2026-10-22',PROVEEDOR:'Progreso',FACTURA:'S123',TOTAL:59,PENDIENTE:0},
    {ID_COMPRA:106,FECHA:'2026-10-21',PROVEEDOR:'Oficina Central',FACTURA:'COMPRA-4',TOTAL:33114,PENDIENTE:33114}
  ]}));
  await page.getByRole('button',{name:'Reportes',exact:true}).click();
  await page.getByLabel('Tipo de reporte').selectOption('compras');
  await page.getByRole('button',{name:'Consultar reporte',exact:true}).click();
  await expect(page.getByRole('cell',{name:'Q 59.00',exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Estado de pago',exact:true}).selectOption('pendiente');
  await expect(page.getByRole('cell',{name:'Progreso',exact:true})).toHaveCount(0);
  await expect(page.getByRole('cell',{name:'Q 33,114.00',exact:true})).toHaveCount(2);
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar reporte CSV'}).click();
  const csv=await readFile(await (await dl).path(),'utf8');expect(csv).toContain('Total (Q)');expect(csv).toContain('33114.00');expect(csv).not.toContain('Progreso');
  await page.getByLabel('Total de compra mínimo (Q)').fill('40000');
  await expect(page.getByText('Ningún registro coincide con estos filtros')).toBeVisible();
  await page.getByRole('button',{name:'Limpiar filtros del reporte'}).click();
  await page.locator('.operativo-reportes').screenshot({path:'test-results/reportes-claros.png'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("auditoría legible, nombres afectados y guía cuando el módulo está vacío", async ({page})=>{
  await iniciar(page);let ultima;
  await page.route('**/api/auditoria*',r=>{
    ultima=new URL(r.request().url());const vacio=ultima.searchParams.get('tabla')==='CLIENTES';
    return r.fulfill({json:{total:vacio?0:2,acciones:['PEDIDO_CREADO','USUARIO_ELIMINADO'],registros:vacio?[]:[
      {ID_BITACORA:2,FECHA_HORA:'2026-10-29T18:00:00Z',ACTOR:'admin',ACTOR_NOMBRE:'Administración',ACCION:'PEDIDO_CREADO',TABLA_AFECTADA:'PEDIDOS',ID_REGISTRO_AFECTADO:295,DETALLE:'{"subtotal":3,"total":1.5,"estado":"PENDIENTE_APROBACION"} Descuento: 50%'},
      {ID_BITACORA:1,FECHA_HORA:'2026-10-29T17:00:00Z',ACTOR:'admin',ACCION:'USUARIO_ELIMINADO',TABLA_AFECTADA:'USUARIOS',ID_REGISTRO_AFECTADO:44,DETALLE:'{"nombreCompleto":"Ana López","nombreUsuario":"ana"}'}
    ]}});
  });
  await page.getByRole('button',{name:'Auditoría',exact:true}).click();
  await expect(page.getByText('Q 1.50',{exact:true})).toBeVisible();
  await expect(page.getByText('Pendiente de aprobación',{exact:true})).toBeVisible();
  await expect(page.getByText('Ana López',{exact:true})).toBeVisible();
  await expect(page.locator('.auditoria-eventos')).not.toContainText('{"subtotal"');
  await page.locator('.operativo-auditoria').screenshot({path:'test-results/auditoria-clara.png'});
  await page.getByLabel('Realizado por',{exact:true}).fill('admin');
  await page.getByRole('button',{name:'Aplicar filtros de auditoría'}).click();
  await expect.poll(()=>ultima.searchParams.get('usuario')).toBe('admin');
  await page.getByLabel('Módulo auditado').selectOption('CLIENTES');
  await expect(page.getByText('¿Qué muestra Clientes?',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'No hay eventos de clientes con estos filtros'})).toBeVisible();
  await page.getByRole('button',{name:'Ver todos los módulos sin filtros'}).click();
  await expect(page.getByText('Ana López',{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.operativo-auditoria').screenshot({path:'test-results/auditoria-clara-mobile.png'});
});
