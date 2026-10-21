import { test, expect } from "@playwright/test";
import {readFile} from "node:fs/promises";
async function iniciar(page, admin = true) {
  const estado = { consultas: [], movimiento: null, anulado: false };
  await page.route("**/api/**", async route => {
    const r = route.request(), u = new URL(r.url()), path = u.pathname.replace("/api", "");
    const ok = json => route.fulfill({ json });
    if (path === "/empleado/mi-carnet") return ok({empleado:{ID_USUARIO:1,NOMBRE_COMPLETO:"Prueba"},resumen:{VENTAS:0,TOTAL:0},ventas:[]});
    if (path === "/auth/login") return ok({ token: "test", usuario: { nombre: "Prueba" } });
    if (path === "/auth/permisos") return ok({ usuario: { id: 1, idRol: admin ? 1 : 2, rol: admin ? "Administrador" : "Empleado" }, permisos: ["FINANZAS_GESTIONAR", "VENTAS_GESTIONAR", "REPORTES_VER", "COMPRAS_GESTIONAR", "USUARIOS_GESTIONAR", "ROLES_GESTIONAR", "INVENTARIO_VER"] });
    if (path.startsWith("/finanzas")) estado.consultas.push(path + u.search);
    if (path === "/finanzas/exportar") return ok(Array.from({length:51},(_,i)=>({CONCEPTO:`Movimiento ${i+1}`,MONTO:10})));
    if (path === "/finanzas/compras-pendientes") return ok([]);
    if (path === "/finanzas/movimientos") { estado.movimiento = r.postDataJSON(); return ok({ id: 1 }); }
    if (path.endsWith("/anular")) { estado.anulado = true; return ok({}); }
    if (path === "/finanzas/resumen") {
      const gasto = estado.movimiento && !estado.anulado ? 25 : 0;
      return ok({ totales: { INGRESOS: 500, EGRESOS: gasto, BALANCE: 500 - gasto, SALDO_ANTERIOR: 100, APERTURAS: 0, SALDO: 600 - gasto }, porMetodo: [{ METODO: "EFECTIVO", INGRESOS: 500, EGRESOS: gasto, SALDO: 600 - gasto }], porDia: [], movimientos: gasto ? [{ ID: "MANUAL-1", ID_MANUAL: 1, FECHA: "2026-10-20", TIPO: "EGRESO", CONCEPTO: "Luz", METODO: "EFECTIVO", MONTO: 25 }] : [], totalMovimientos: gasto ? 1 : 0 });
    }
    return ok([]);
  });
  await page.goto("/");
  await page.locator("#usuario").fill("prueba"); await page.locator("#contrasena").fill("prueba");
  await page.getByRole("button", { name: /Iniciar sesi/ }).click();
  return estado;
}
test("administrador consulta dia mes y anio y registra un gasto", async ({ page }) => {
  const estado = await iniciar(page);
  const panel = page.getByRole("region", { name: /Finanzas/ });
  await expect(panel.getByText("Ingresos del período", { exact: true })).toBeVisible();
  await panel.getByLabel("Fecha de referencia").fill("2024-02-15");
  await panel.getByRole("button", { name: "Mes", exact: true }).click();
  await expect.poll(() => estado.consultas.some(u => u.includes("hasta=2024-02-29"))).toBe(true);
  await panel.getByRole("button", { name: "Año", exact: true }).click();
  await expect.poll(() => estado.consultas.some(u => u.includes("desde=2024-01-01") && u.includes("hasta=2024-12-31"))).toBe(true);
  await panel.locator('summary').filter({hasText:"Registrar movimiento"}).click();
  await panel.getByLabel("Monto (Q)", { exact: true }).fill("25");
  await panel.getByLabel("Concepto", { exact: true }).fill("Luz");
  await panel.getByRole("button", { name: "Registrar movimiento", exact: true }).click();
  await panel.getByText("Ver movimientos y saldos por método", { exact: true }).click();
  await expect(panel.getByRole("cell", { name: "Luz", exact: true })).toBeVisible();
  expect(estado.movimiento).toMatchObject({ categoria: "GASTO", monto: 25, metodo: "EFECTIVO" });
  await panel.getByRole("button", { name: "Anular", exact: true }).click();
  await panel.getByLabel("Motivo de anulación").fill("Error");
  await panel.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(panel.getByRole("cell", { name: "Luz", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/finanzas-mobile.png", fullPage: true });
});
test("empleado no consulta finanzas ni ve administracion aun con permisos antiguos", async ({ page }) => {
  const estado = await iniciar(page, false);
  await expect(page.getByRole("button", { name: /^Ventas a clientes/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /Finanzas/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Usuarios/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Roles y Permisos/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Compras e inventario/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Inventario/ })).toBeVisible();
  expect(estado.consultas).toEqual([]);
});


test("descarga financiera consulta rango completo y produce CSV",async({page})=>{
  const e=await iniciar(page);
  const boton=page.getByRole('button',{name:'Descargar movimientos CSV'});
  await expect(boton).toBeEnabled();
  const esperando=page.waitForEvent('download');await boton.click();const archivo=await esperando;
  const csv=await readFile(await archivo.path(),'utf8');
  expect(csv.split('\r\n')).toHaveLength(52);expect(csv).toContain('Movimiento 51');
  expect(e.consultas.some(u=>u.startsWith('/finanzas/exportar?')&&u.includes('desde=')&&u.includes('hasta='))).toBe(true);
});
