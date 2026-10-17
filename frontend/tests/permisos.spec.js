import { test, expect } from "@playwright/test";

// Navegador real; respuestas API simuladas. La integración Oracle se prueba aparte.
async function iniciar(page, permisos, idRol = 2) {
  const estado = { permisos, idRol, denegar: false, falloSesion: false, peticiones: [] };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api", "");
    estado.peticiones.push(`${route.request().method()} ${path}`);
    const responder = (json, status = 200) => route.fulfill({ status, json });
    if (path === "/auth/login")
      return responder({ token: "prueba", usuario: { id: 2, nombre: "Prueba", rol: "Empleado" } });
    if (path === "/auth/permisos")
      return estado.falloSesion
        ? responder({ mensaje: "Usuario o rol inactivo" }, 403)
        : responder({
            permisos: estado.permisos,
            usuario: {
              id: 2,
              idRol: estado.idRol,
              rol: estado.idRol === 1 ? "Administrador" : "Empleado",
            },
          });
    if (route.request().method() !== "GET")
      return estado.denegar
        ? responder({ mensaje: "No tienes permisos para realizar esta acción" }, 403)
        : responder({ mensaje: "Guardado" }, 201);
    if (path === "/clientes")
      return responder([{ ID_CLIENTE: 1, NOMBRES: "Cliente prueba", ESTADO: "A" }]);
    if (path === "/productos")
      return responder([
        {
          ID_PRODUCTO: 1,
          CODIGO: "P1",
          NOMBRE: "Producto prueba",
          CATEGORIA: "Libros",
          ID_CATEGORIA: 1,
          PRECIO: 10,
          STOCK: 2,
          ESTADO: "A",
        },
      ]);
    if (path === "/categorias")
      return responder([{ ID_CATEGORIA: 1, NOMBRE: "Libros", ESTADO: "A" }]);
    if (path === "/roles" || path === "/usuarios/roles-asignables")
      return responder([
        { ID_ROL: 2, NOMBRE: "Empleado", ESTADO: "A" },
        ...(estado.idRol === 1 ? [{ ID_ROL: 1, NOMBRE: "Administrador", ESTADO: "A" }] : []),
      ]);
    if (path === "/roles/permisos")
      return responder([{ ID_PERMISO: 1, CODIGO: "CLIENTES_VER", DESCRIPCION: "Consultar" }]);
    if (/^\/roles\/\d+\/permisos$/.test(path))
      return responder([{ ID_PERMISO: 1, CODIGO: "CLIENTES_VER" }]);
    if (path === "/usuarios")
      return responder([
        {
          ID_USUARIO: 2,
          NOMBRE_COMPLETO: "Prueba",
          NOMBRE_USUARIO: "prueba",
          ID_ROL: 2,
          ROL: "Empleado",
          ESTADO: "A",
        },
      ]);
    return responder({ mensaje: "Ruta no simulada" }, 404);
  });
  await page.goto("/");
  await page.locator("#usuario").fill("prueba");
  await page.locator("#contrasena").fill("prueba");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByText("¡Bienvenido, Prueba!")).toBeVisible();
  return estado;
}

test("Empleado de consulta: menú y botones de ambos módulos", async ({ page }) => {
  await iniciar(page, ["CLIENTES_VER", "PRODUCTOS_VER"]);
  await expect(page.getByRole("button", { name: /Administración de usuarios/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Roles y Permisos/ })).toHaveCount(0);
  for (const [modulo, registro] of [
    ["Clientes", "Cliente prueba"],
    ["Productos", "Producto prueba"],
  ]) {
    await page.getByRole("button", { name: new RegExp(`^${modulo} `) }).click();
    await expect(page.getByText(registro, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Nuevo |Crear categoría|Editar|Activar|Desactivar/ }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Volver al menú" }).click();
  }
});

for (const [modulo, singular, prefijo] of [
  ["Clientes", "cliente", "CLIENTES"],
  ["Productos", "producto", "PRODUCTOS"],
]) {
  test(`${modulo}: crear sin consultar`, async ({ page }) => {
    const estado = await iniciar(page, [`${prefijo}_CREAR`]);
    await page.getByRole("button", { name: new RegExp(`^${modulo} `) }).click();
    await page.getByRole("button", { name: `Nuevo ${singular}` }).click();
    await expect(page.getByRole("heading", { name: `Registrar ${singular}` })).toBeVisible();
    expect(estado.peticiones).not.toContain(`GET /${modulo.toLowerCase()}`);
    await expect(page.getByRole("table")).toHaveCount(0);
  });
  test(`${modulo}: editar sin crear y revocar mientras está abierto`, async ({ page }) => {
    const estado = await iniciar(page, [`${prefijo}_VER`, `${prefijo}_EDITAR`]);
    await page.getByRole("button", { name: new RegExp(`^${modulo} `) }).click();
    await page.getByRole("button", { name: `Editar ${singular}` }).click();
    await expect(page.getByRole("heading", { name: `Modificar ${singular}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Nuevo ${singular}` })).toHaveCount(0);
    estado.permisos = [`${prefijo}_VER`];
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("heading", { name: `Modificar ${singular}` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Desactivar", exact: true })).toHaveCount(0);
  });
}

test("403 muestra mensaje comprensible", async ({ page }) => {
  const estado = await iniciar(page, ["CLIENTES_VER", "CLIENTES_CREAR"]);
  estado.denegar = true;
  await page.getByRole("button", { name: /^Clientes / }).click();
  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  await page.getByLabel("Nombres", { exact: true }).fill("Prueba");
  await page.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(page.getByRole("alert")).toHaveText("No tienes permisos para realizar esta acción");
});

test("revocación periódica cierra pantalla administrativa sin otro login", async ({ page }) => {
  const estado = await iniciar(page, ["USUARIOS_GESTIONAR"]);
  await page.getByRole("button", { name: /^Usuarios / }).click();
  await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toBeVisible();
  estado.permisos = [];
  await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(
    page.getByText("Tu usuario no tiene funciones asignadas.", { exact: false }),
  ).toBeVisible();
});

test("rol inactivo elimina la pantalla y muestra rechazo", async ({ page }) => {
  const estado = await iniciar(page, ["CLIENTES_VER"]);
  await page.getByRole("button", { name: /^Clientes / }).click();
  estado.falloSesion = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toHaveText("Usuario o rol inactivo");
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("nuevo permiso aparece al recuperar foco sin repetir login", async ({ page }) => {
  const estado = await iniciar(page, []);
  await expect(page.getByRole("button", { name: /^Clientes / })).toHaveCount(0);
  estado.permisos = ["CLIENTES_VER"];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: /^Clientes / })).toBeVisible();
  expect(estado.peticiones.filter((p) => p === "POST /auth/login")).toHaveLength(1);
});

test("navegar a URL administrativa no concede acceso", async ({ page }) => {
  await iniciar(page, ["CLIENTES_VER"]);
  await page.evaluate(() => {
    history.pushState({}, "", "/usuarios");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: "Gestión de Usuarios" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#usuario")).toBeVisible();
});

test("gestor de roles no administrador solo consulta", async ({ page }) => {
  await iniciar(page, ["ROLES_GESTIONAR"]);
  await page.getByRole("button", { name: /^Roles y Permisos / }).click();
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Guardar permisos" })).toHaveCount(0);
});

test("administrador puede guardar permisos de Empleado", async ({ page }) => {
  await iniciar(page, ["ROLES_GESTIONAR"], 1);
  await page.getByRole("button", { name: /^Roles y Permisos / }).click();
  await expect(page.getByRole("checkbox")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Guardar permisos" })).toBeEnabled();
  await page.getByLabel("Seleccionar rol").selectOption("1");
  await expect(page.getByRole("button", { name: "Guardar permisos" })).toHaveCount(0);
});

test("gestor de usuarios no puede cambiar su propio rol o estado", async ({ page }) => {
  await iniciar(page, ["USUARIOS_GESTIONAR"]);
  await page.getByRole("button", { name: /^Usuarios / }).click();
  await expect(page.getByRole("button", { name: "Desactivar" })).toBeDisabled();
  await page.getByRole("button", { name: "Editar prueba" }).click();
  await expect(page.getByRole("combobox")).toBeDisabled();
  await expect(page.getByRole("option", { name: "Administrador", exact: true })).toHaveCount(0);
});
