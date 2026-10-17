import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const foto = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64",
);
async function inicio(page) {
  const estado = { imagen: null, datos: null };
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      ruta = new URL(req.url()).pathname.replace("/api", "");
    const ok = (json, status = 200) => route.fulfill({ json, status });
    if (ruta === "/auth/login")
      return ok({ token: "prueba", usuario: { nombre: "Equipo", rol: "Administrador" } });
    if (ruta === "/auth/permisos")
      return ok({
        usuario: { nombre: "Equipo", rol: "Administrador", idRol: 1 },
        permisos: [
          "PRODUCTOS_VER",
          "PRODUCTOS_CREAR",
          "PRODUCTOS_EDITAR",
          "PROVEEDORES_GESTIONAR",
          "COMPRAS_GESTIONAR",
          "INVENTARIO_VER",
          "INVENTARIO_GESTIONAR",
          "USUARIOS_GESTIONAR",
          "ROLES_GESTIONAR",
          "CLIENTES_VER",
        ],
      });
    if (ruta === "/categorias") return ok([{ ID_CATEGORIA: 1, NOMBRE: "Escritura", ESTADO: "A" }]);
    if (ruta === "/productos/1/imagen")
      return estado.imagen
        ? route.fulfill({ contentType: "image/png", body: foto })
        : route.fulfill({ status: 204 });
    if (ruta === "/productos/1" && req.method() === "PUT") {
      estado.datos = req.postDataJSON();
      if ("imagen" in estado.datos) estado.imagen = estado.datos.imagen;
      return ok({ mensaje: "Producto actualizado correctamente" });
    }
    if (ruta === "/productos")
      return ok([
        {
          ID_PRODUCTO: 1,
          CODIGO: "COL-12",
          NOMBRE: "Colores de madera",
          PRECIO: 25,
          STOCK: 12,
          ID_CATEGORIA: 1,
          CATEGORIA: "Escritura",
          ESTADO: "A",
        },
      ]);
    if (ruta === "/inventario")
      return ok([
        {
          ID_PRODUCTO: 1,
          CODIGO: "COL-12",
          NOMBRE: "Colores de madera",
          STOCK: 12,
          STOCK_MINIMO: 5,
          ESTADO: "A",
          ALERTA: 0,
        },
      ]);
    if (["/proveedores", "/compras", "/catalogo-compras", "/movimientos"].includes(ruta))
      return ok([]);
    return ok([], 404);
  });
  await page.goto("/");
  await page.locator("#usuario").fill("demo");
  await page.locator("#contrasena").fill("demo");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByText("¡Bienvenido, Equipo!")).toBeVisible();
  return estado;
}
test("foto tiene vista previa, persiste al guardar y puede quitarse", async ({ page }) => {
  const estado = await inicio(page);
  await page.getByRole("button", { name: /^Productos / }).click();
  await page.getByRole("button", { name: "Editar producto" }).click();
  await page
    .getByLabel("Seleccionar imagen")
    .setInputFiles({ name: "producto.png", mimeType: "image/png", buffer: foto });
  await expect(page.getByAltText("Vista previa del producto")).toBeVisible();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Producto actualizado");
  expect(estado.datos.imagen).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByAltText("Colores de madera")).toBeVisible();
  await page.getByRole("button", { name: "Editar producto" }).click();
  await page.getByRole("button", { name: "Quitar imagen" }).click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("img", { name: "Sin foto de Colores de madera" })).toBeVisible();
  expect(estado.datos.imagen).toBeNull();
});
test("archivo incompatible no reemplaza la selección", async ({ page }) => {
  await inicio(page);
  await page.getByRole("button", { name: /^Productos / }).click();
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await page
    .getByLabel("Seleccionar imagen")
    .setInputFiles({ name: "texto.txt", mimeType: "text/plain", buffer: Buffer.from("texto") });
  await expect(page.getByRole("alert")).toContainText("JPEG, PNG o WebP");
  await expect(page.getByAltText("Vista previa del producto")).toHaveCount(0);
});
test("vistas de escritorio y móvil conservan navegación sin desbordamiento", async ({ page }) => {
  const destino = path.resolve("../docs/entrega2/evidencias");
  fs.mkdirSync(destino, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await inicio(page);
  await page.screenshot({ path: path.join(destino, "interfaz_menu_demo.png"), fullPage: true });
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await page.getByRole("button", { name: "Inventario", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Disponible", exact: true })).toBeVisible();
  await page.screenshot({
    path: path.join(destino, "interfaz_inventario_demo.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: path.join(destino, "interfaz_movil_demo.png"), fullPage: true });
  await page.getByRole("button", { name: "Volver al menú" }).click();
  await page.getByRole("button", { name: /^Productos / }).click();
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
