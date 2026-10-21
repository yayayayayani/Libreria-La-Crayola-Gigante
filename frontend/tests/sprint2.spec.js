import { test, expect } from "@playwright/test";

test("registra una nota de crédito y conserva su evidencia en el detalle", async ({ page }) => {
  await iniciar(page);
  const compra = { ID_COMPRA: 81, PROVEEDOR: "Unimarck", FACTURA: "S345", TOTAL: 53.25, ID_RECEPCION: 60, ESTADO: "RECIBIDA" };
  const datos = {
    compra, recepcion: { ID_RECEPCION: 60, FECHA: "2026-10-19T18:00:00Z" },
    detalles: [{ ID_DETALLE: 1, NOMBRE: "Hojas", CANTIDAD: 5, COSTO: 10.65, CANTIDAD_DANADA: 1 }],
    recuperaciones: [],
    saldoRechazos: { rechazado: 10.65, acreditado: 0, reembolsado: 0, perdida: 0, pendiente: 10.65 },
  };
  await page.route("**/api/compras", (route) => route.fulfill({ json: [{ ...compra, PENDIENTE_RECUPERAR: datos.saldoRechazos.pendiente }] }));
  await page.route("**/api/compras/81", (route) => route.fulfill({ json: datos }));
  await page.route("**/api/compras/81/recuperaciones", (route) => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ tipo: "NOTA_CREDITO", monto: 10.65, referencia: "NC-123", fechaDocumento: "2026-10-19" });
    datos.saldoRechazos.acreditado = 10.65;
    datos.saldoRechazos.pendiente = 0;
    datos.recuperaciones.push({ ID_RECUPERACION: 1, TIPO: body.tipo, MONTO: body.monto,
      REFERENCIA: body.referencia, FECHA_DOCUMENTO: body.fechaDocumento,
      REGISTRADO_POR: "Ana", CREADO_EN: "2026-10-19T18:00:00Z" });
    return route.fulfill({ status: 201, json: { mensaje: "Resolución registrada" } });
  });
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await page.getByRole("button", { name: "Compras", exact: true }).click();
  await page.getByRole("button", { name: "Ver detalle" }).click();
  const seguimiento = page.getByRole("region", { name: "Seguimiento del dinero rechazado" });
  await seguimiento.getByRole("button", { name: "Registrar resolución del saldo" }).click();
  await expect(page.getByLabel("Monto a registrar (Q)")).toHaveValue("10.65");
  await page.getByLabel("Número de nota, comprobante o autorización").fill("NC-123");
  await page.getByLabel("Fecha del documento", { exact: true }).fill("2026-10-19");
  await page.getByRole("button", { name: "Guardar resolución" }).click();
  await expect(seguimiento.getByText("NC-123")).toBeVisible();
  await expect(seguimiento.getByText("El monto rechazado está completamente documentado.")).toBeVisible();
  await expect(seguimiento.getByRole("button", { name: "Registrar resolución del saldo" })).toHaveCount(0);
});

test("detalle de compra desglosa factura, recepción y rechazos", async ({ page }) => {
  await iniciar(page);
  const compra = { ID_COMPRA: 81, PROVEEDOR: "Unimarck", PROVEEDOR_NIT: "12345678",
    FACTURA: "S345", TOTAL: 53.25, REGISTRADO_POR: "Ana López", FECHA: "2026-10-19T18:00:00Z",
    ID_RECEPCION: 60, ESTADO: "RECIBIDA" };
  await page.route("**/api/compras", (route) => route.fulfill({ json: [compra] }));
  await page.route("**/api/compras/81", (route) => route.fulfill({ json: {
    compra, recepcion: { ID_RECEPCION: 60, FECHA: compra.FECHA },
    detalles: [{ ID_DETALLE: 1, NOMBRE: "Paquete de hojas", CODIGO: "HOJ-01",
      CANTIDAD: 5, COSTO: 10.65, CANTIDAD_DANADA: 1, OBSERVACIONES: "Un paquete estaba mojado" }],
  } }));
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await page.getByRole("button", { name: "Compras", exact: true }).click();
  await page.getByRole("button", { name: "Ver detalle" }).click();
  const detalle = page.getByRole("region", { name: "Detalle de compra 81" });
  await expect(detalle.getByText("Ana López")).toBeVisible();
  await expect(detalle.getByText("Un paquete estaba mojado")).toBeVisible();
  await expect(detalle.getByRole("cell", { name: "Rechazo parcial" })).toBeVisible();
  const fila = detalle.getByRole("row").nth(1);
  await expect(fila.getByRole("cell").nth(1)).toHaveText("5");
  await expect(fila.getByRole("cell").nth(2)).toHaveText("4");
  await expect(fila.getByRole("cell").nth(3)).toHaveText("1");
  await expect(detalle.getByText(/Valor de unidades aceptadas:/)).toContainText("42.60");
  await expect(detalle.getByText(/Valor de unidades rechazadas:/)).toContainText("10.65");
  await detalle.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(detalle).toHaveCount(0);
});

test("recargar conserva sesión y módulo; cerrar sesión los elimina", async ({ page }) => {
  await iniciar(page);
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Compras e inventario", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Volver al menú/ }).click();
  await page.getByRole("button", { name: /Cerrar sesión/ }).click();
  await page.reload();
  await expect(page.locator("#usuario")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("crayola.sesion"))).toBeNull();
});

test("recargar con token vencido exige iniciar sesión nuevamente", async ({ page }) => {
  await iniciar(page);
  await page.route("**/api/auth/permisos", (route) =>
    route.fulfill({ status: 401, json: { mensaje: "Sesión expirada" } }));
  await page.reload();
  await expect(page.locator("#usuario")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("crayola.sesion"))).toBeNull();
});

test("eliminar proveedor solicita confirmación y permite cancelar", async ({ page }) => {
  await iniciar(page);
  let eliminado = false;
  await page.route("**/api/proveedores/1", async (route) => {
    expect(route.request().method()).toBe("DELETE");
    eliminado = true;
    await route.fulfill({ json: { mensaje: "Proveedor eliminado" } });
  });
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await page.getByRole("button", { name: "Proveedores", exact: true }).click();
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
  await page.getByRole("button", { name: "Proveedores", exact: true }).click();
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
// El flujo de ventas se valida en sprint3.spec.js.
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
          STOCK_MINIMO: 10,
          ESTADO: "A",
          ALERTA: estado.stock < 10 ? 1 : 0,
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
  await page.getByLabel("Unidades dañadas 1").fill("");
  await page.getByLabel("Costo unitario (Q)").fill("2.50");
  await page.getByRole("button", { name: "Confirmar recepción y registrar compra" }).click();
  await expect(page.getByText("Compra recibida e inventario actualizado. Compra #7")).toBeVisible();
  expect(estado.compra.detalles).toEqual([{ idProducto: 1, cantidad: 4, costo: 2.5, cantidadDanada: 0, observaciones: "" }]);
  expect(estado.compra.clave).toHaveLength(32);
});
test("inventario actualiza cambios de otro usuario y resuelve alerta", async ({ page }) => {
  const estado = await iniciar(page, ["INVENTARIO_VER"]);
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await expect(page.getByText("1 productos activos por debajo de su mínimo (10 unidades por defecto).")).toBeVisible();
  estado.stock = 10;
  await expect(page.getByText("0 productos activos por debajo de su mínimo (10 unidades por defecto).")).toBeVisible({
    timeout: 8000,
  });
  await expect(page.getByRole("cell", { name: "10", exact: true }).first()).toBeVisible();
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

test("recepción permite revisar 80 unidades y rechazar 10", async ({ page }) => {
  const estado = await iniciar(page);
  await page.getByRole("button", { name: /^Compras e inventario/ }).click();
  await page.getByRole("button", { name: "Compras", exact: true }).click();
  await page.getByRole("combobox", { name: "Proveedor", exact: true }).selectOption("1");
  await page.getByLabel("Serie y número de factura").fill("A-80");
  await page.getByRole("combobox", { name: "Producto 1", exact: true }).selectOption("1");
  await page.getByLabel("Cantidad", { exact: true }).fill("80");
  await page.getByLabel("Costo unitario (Q)").fill("2");
  await page.getByLabel("Unidades dañadas 1").fill("10");
  await expect(page.getByText(/Al inventario: 70 unidades/)).toBeVisible();
  await expect(page.getByLabel("Observaciones de recepción 1")).not.toHaveAttribute("required");
  await page.getByRole("button", { name: "Confirmar recepción y registrar compra" }).click();
  await expect(page.getByText("Compra recibida e inventario actualizado. Compra #7")).toBeVisible();
  expect(estado.compra.detalles[0]).toMatchObject({ cantidad: 80, cantidadDanada: 10, observaciones: "" });
});
