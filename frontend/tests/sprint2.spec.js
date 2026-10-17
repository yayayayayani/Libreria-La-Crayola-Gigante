import { test, expect } from "@playwright/test";
import { VENTAS_HABILITADAS } from "../src/features";
test("eliminar proveedor solicita confirmación y permite cancelar", async ({ page }) => {
  await iniciar(page);
  let eliminado = false;
  await page.route("**/api/proveedores/1", async (route) => {
    expect(route.request().method()).toBe("DELETE");
    eliminado = true;
    await route.fulfill({ json: { mensaje: "Proveedor eliminado" } });
  });
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  expect(eliminado).toBe(false);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Proveedor eliminado");
  expect(eliminado).toBe(true);
});
test("proveedor permite nombre libre, NIT con guion y valida DPI", async ({ page }) => {
  const estado = await iniciar(page);
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await page.getByLabel("Nombre comercial").fill("1");
  await page.getByLabel("NIT", { exact: true }).fill("1234567-8");
  const telefono = page.getByLabel("Teléfono", { exact: true });
  await telefono.pressSequentially("50251234");
  await expect(telefono).toHaveValue("5025-1234");
  await telefono.press("Backspace");
  await expect(telefono).toHaveValue("5025-123");
  await telefono.fill("");
  await expect(telefono).toHaveValue("");
  await telefono.pressSequentially("12341234");
  await expect(telefono).toHaveValue("1234-1234");
  await telefono.evaluate((input) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text", "+502 1234-1234");
    input.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
    );
  });
  await expect(telefono).toHaveValue("1234-1234");
  await page.getByRole("button", { name: "Guardar proveedor" }).click();
  await expect(page.getByRole("status")).toContainText("Proveedor guardado");
  expect(estado.proveedor.nit).toBe("1234567-8");
  expect(estado.proveedor.telefono).toBe("+502 1234-1234");
  await page.getByLabel("Tipo de documento").selectOption("DPI");
  await page.getByLabel("Nombre comercial").fill("Comercio #123 & Cía.");
  const dpi = page.getByLabel("DPI", { exact: true });
  await dpi.fill("123");
  expect(await dpi.evaluate((e) => e.validity.patternMismatch)).toBe(true);
  await dpi.fill("1234567890123");
  await page.getByRole("button", { name: "Guardar proveedor" }).click();
  await expect(dpi).toHaveCount(0);
  expect(estado.proveedor.tipoDocumento).toBe("DPI");
});
for (const modo of ["cf", "existente", "nuevo"])
  test(`venta con ${modo}`, async ({ page }) => {
    test.skip(!VENTAS_HABILITADAS, "Ventas a clientes se habilitará en el siguiente sprint");
    const estado = await iniciar(page, ["VENTAS_GESTIONAR", "CLIENTES_CREAR"]);
    await page.getByRole("button", { name: /^Ventas a clientes/ }).click();
    await page.getByLabel("Cliente de la venta").selectOption(modo);
    if (modo === "existente")
      await page.getByRole("combobox", { name: "Cliente", exact: true }).selectOption("1");
    if (modo === "nuevo") {
      await page.getByLabel("Nombres", { exact: true }).fill("Ana");
      await page.getByLabel("NIT", { exact: true }).fill("1234567-8");
    }
    await page.getByLabel("Producto 1").selectOption("1");
    await page.getByRole("button", { name: "Confirmar venta" }).click();
    await expect(page.getByRole("status")).toContainText("Venta #9");
    expect(estado.venta.modo).toBe(modo);
    expect(estado.venta.detalles).toEqual([{ idProducto: 1, cantidad: 1 }]);
  });
async function iniciar(
  page,
  permisos = [
    "PROVEEDORES_GESTIONAR",
    "COMPRAS_GESTIONAR",
    "INVENTARIO_VER",
    "INVENTARIO_GESTIONAR",
  ],
) {
  const estado = { stock: 2, compra: null, peticiones: [] };
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api", "");
    estado.peticiones.push(`${req.method()} ${path}`);
    const ok = (json, status = 200) => route.fulfill({ json, status });
    if (path === "/auth/login")
      return ok({ token: "prueba", usuario: { id: 1, nombre: "Prueba", rol: "Administrador" } });
    if (path === "/auth/permisos")
      return ok({ permisos, usuario: { id: 1, idRol: 1, nombre: "Prueba", rol: "Administrador" } });
    if (path === "/proveedores" && req.method() === "POST") {
      estado.proveedor = req.postDataJSON();
      return ok({ mensaje: "Proveedor guardado" }, 201);
    }
    if (path === "/proveedores")
      return ok([{ ID_PROVEEDOR: 1, NOMBRE: "Distribuidora", NIT: "1234567K", ESTADO: "A" }]);
    if (path === "/ventas/catalogo")
      return ok({
        productos: [{ ID_PRODUCTO: 1, CODIGO: "C1", NOMBRE: "Cuaderno", PRECIO: 5, STOCK: 10 }],
        clientes: [{ ID_CLIENTE: 1, NOMBRES: "Ana", APELLIDOS: "Pérez", NIT: "12345678" }],
      });
    if (path === "/ventas" && req.method() === "POST") {
      estado.venta = req.postDataJSON();
      return ok({ id: 9, total: 5, mensaje: "Venta registrada" }, 201);
    }
    if (path === "/ventas") return ok([]);
    if (path === "/catalogo-compras")
      return ok([{ ID_PRODUCTO: 1, NOMBRE: "Cuaderno", CODIGO: "C1" }]);
    if (path === "/compras" && req.method() === "POST") {
      estado.compra = req.postDataJSON();
      return ok({ id: 7, mensaje: "Compra recibida e inventario actualizado" }, 201);
    }
    if (path === "/compras") return ok([]);
    if (path === "/inventario")
      return ok([
        {
          ID_PRODUCTO: 1,
          NOMBRE: "Cuaderno",
          CODIGO: "C1",
          STOCK: estado.stock,
          STOCK_MINIMO: 3,
          ESTADO: "A",
          ALERTA: estado.stock <= 3 ? 1 : 0,
        },
      ]);
    if (path === "/movimientos") return ok([]);
    if (path === "/usuarios/roles-asignables") return ok([{ ID_ROL: 1, NOMBRE: "Administrador" }]);
    if (path === "/usuarios" && req.method() === "POST")
      return ok(
        { mensaje: "El correo ya está registrado. No se puede asignar a otra cuenta." },
        409,
      );
    if (path === "/usuarios") return ok([]);
    return ok({ mensaje: "Ruta no simulada" }, 404);
  });
  await page.goto("/");
  await page.locator("#usuario").fill("prueba");
  await page.locator("#contrasena").fill("prueba");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  return estado;
}
test("compra completa envía detalle y muestra confirmación", async ({ page }) => {
  const estado = await iniciar(page);
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await page.getByRole("button", { name: "Compras", exact: true }).click();
  await page.getByRole("combobox", { name: "Proveedor", exact: true }).selectOption("1");
  await page.getByLabel("Serie y número de factura").fill("A-1");
  await page.getByRole("combobox", { name: "Producto 1", exact: true }).selectOption("1");
  await page.getByLabel("Cantidad", { exact: true }).fill("4");
  await page.getByLabel("Costo unitario (Q)").fill("2.50");
  await page.getByRole("button", { name: "Confirmar recepción y registrar compra" }).click();
  await expect(page.getByText("Compra recibida e inventario actualizado. Compra #7")).toBeVisible();
  expect(estado.compra.detalles).toEqual([{ idProducto: 1, cantidad: 4, costo: 2.5 }]);
  expect(estado.compra.clave).toHaveLength(32);
});
test("inventario actualiza cambios de otro usuario y resuelve alerta", async ({ page }) => {
  const estado = await iniciar(page, ["INVENTARIO_VER"]);
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await expect(page.getByText("1 productos activos en su mínimo o por debajo.")).toBeVisible();
  estado.stock = 10;
  await expect(page.getByText("0 productos activos en su mínimo o por debajo.")).toBeVisible({
    timeout: 8000,
  });
  await expect(page.getByRole("cell", { name: "10", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar", exact: true })).toHaveCount(0);
});
test("permiso de consulta oculta compras y proveedores", async ({ page }) => {
  const estado = await iniciar(page, ["INVENTARIO_VER"]);
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await expect(page.getByRole("button", { name: "Compras", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Proveedores", exact: true })).toHaveCount(0);
  expect(estado.peticiones).not.toContain("GET /compras");
  expect(estado.peticiones).not.toContain("GET /proveedores");
});
test("formulario bloquea nombre numérico antes de enviar", async ({ page }) => {
  const estado = await iniciar(page, ["USUARIOS_GESTIONAR"]);
  await page.getByRole("button", { name: /^Usuarios / }).click();
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  await page.getByLabel("Nombre completo").fill("Pedro123");
  await page.getByLabel("Nombre de usuario").fill("pedro");
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba12345");
  await page.getByLabel("Correo electrónico").fill("prueba@example.invalid");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  expect(await page.getByLabel("Nombre completo").evaluate((e) => e.validity.patternMismatch)).toBe(
    true,
  );
  expect(estado.peticiones).not.toContain("POST /usuarios");
});
test("correo duplicado muestra aviso y conserva el formulario", async ({ page }) => {
  await iniciar(page, ["USUARIOS_GESTIONAR"]);
  await page.getByRole("button", { name: /^Usuarios / }).click();
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  await page.getByLabel("Nombre completo").fill("Pedro Pérez");
  await page.getByLabel("Nombre de usuario").fill("pedro");
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba12345");
  await page.getByLabel("Correo electrónico").fill("prueba@example.invalid");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("El correo ya está registrado");
  await expect(page.getByLabel("Correo electrónico")).toHaveValue("prueba@example.invalid");
});
