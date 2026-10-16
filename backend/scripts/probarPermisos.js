/* Integración real HTTP + JWT + motor configurado. Una conexión aislada y ROLLBACK final.
 * Los commits de controladores se suprimen SOLO en este proceso de pruebas.
 * Ejecutar desde backend: node scripts/probarPermisos.js
 */
require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const db = require("../src/config/driver");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { once } = require("node:events");
const codigos = ["USUARIOS_GESTIONAR", "ROLES_GESTIONAR", "CLIENTES_VER", "CLIENTES_CREAR", "CLIENTES_EDITAR", "PRODUCTOS_VER", "PRODUCTOS_CREAR", "PRODUCTOS_EDITAR", "BITACORA_VER", "REPORTES_EXPORTAR"];
let conexion, servidor, total = 0, fallos = 0;
const getConnection = db.getConnection;
async function main() {
  try {
    conexion = await getConnection({ user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectString: process.env.DB_CONNECT_STRING });
    conexion.callTimeout = 10000;
    const ejecutar = (sql, binds = {}) => conexion.execute(sql, binds, { outFormat: db.OUT_FORMAT_OBJECT });
    const insertar = async (sql, binds = {}) => (await ejecutar(sql, { ...binds, salida: { dir: db.BIND_OUT, type: db.NUMBER } })).outBinds.salida[0];
    const marca = `AUD_${Date.now()}`;
    const rol = await insertar("INSERT INTO ROLES (NOMBRE, DESCRIPCION, ESTADO) VALUES (:nombre, 'Prueba transaccional', 'A') RETURNING ID_ROL INTO :salida", { nombre: marca });
    const hash = await bcrypt.hash("PruebaTemporal!123", 4);
    const usuario = await insertar("INSERT INTO USUARIOS (NOMBRE_COMPLETO,NOMBRE_USUARIO,CONTRASENA_HASH,ID_ROL,ESTADO,CREADO_EN) VALUES ('Prueba',:nombre,:hash,:rol,'A',SYSTIMESTAMP) RETURNING ID_USUARIO INTO :salida", { nombre: marca, hash, rol });
    const administrador = await insertar("INSERT INTO USUARIOS (NOMBRE_COMPLETO,NOMBRE_USUARIO,CONTRASENA_HASH,ID_ROL,ESTADO,CREADO_EN) VALUES ('Prueba',:nombre,:hash,1,'A',SYSTIMESTAMP) RETURNING ID_USUARIO INTO :salida", { nombre: marca + '_A', hash });
    const cliente = await insertar("INSERT INTO CLIENTES (NOMBRES,ESTADO,CREADO_EN) VALUES ('Prueba','A',SYSTIMESTAMP) RETURNING ID_CLIENTE INTO :salida");
    const categoria = await insertar("INSERT INTO CATEGORIAS (NOMBRE,ESTADO) VALUES (:nombre,'A') RETURNING ID_CATEGORIA INTO :salida", { nombre: marca });
    const producto = await insertar("INSERT INTO PRODUCTOS (CODIGO,NOMBRE,PRECIO,STOCK,ID_CATEGORIA,ESTADO,CREADO_EN) VALUES (:codigo,'Prueba',1,0,:categoria,'A',SYSTIMESTAMP) RETURNING ID_PRODUCTO INTO :salida", { codigo: marca, categoria });
    const catalogo = await ejecutar("SELECT ID_PERMISO, CODIGO FROM PERMISOS");
    const ids = Object.fromEntries(catalogo.rows.map(p => [p.CODIGO, p.ID_PERMISO]));
    for (const codigo of codigos) assert.ok(ids[codigo], `Falta permiso ${codigo}`);
    const asignar = async permisos => {
      await ejecutar("DELETE FROM ROL_PERMISO WHERE ID_ROL = :rol", { rol });
      for (const codigo of permisos) await ejecutar("INSERT INTO ROL_PERMISO (ID_ROL,ID_PERMISO) VALUES (:rol,:permiso)", { rol, permiso: ids[codigo] });
    };
    // Ninguna ruta puede confirmar ni cerrar la transacción de esta prueba.
    db.getConnection = async () => ({
      execute: (sql, binds, options) => conexion.execute(sql, binds || {}, { ...options, autoCommit: false }),
      commit: async () => {}, rollback: async () => {}, close: async () => {}
    });
    const app = require("../src/server");
    servidor = app.listen(0, "127.0.0.1");
    await once(servidor, "listening");
    const base = `http://127.0.0.1:${servidor.address().port}/api`;
    const firmar = (id, opciones = {}) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "5m", ...opciones });
    const token = firmar(usuario);
    const adminToken = firmar(administrador);
    const pedir = async (ruta, credencial = token) => {
      const respuesta = await fetch(base + ruta.path, {
        method: ruta.method || "GET",
        headers: { "Content-Type": "application/json", ...(credencial ? { Authorization: `Bearer ${credencial}` } : {}) },
        ...(ruta.body ? { body: JSON.stringify(ruta.body) } : {})
      });
      const texto = await respuesta.text();
      return { status: respuesta.status, texto };
    };
    const comprobar = async (nombre, accion) => {
      total++;
      await ejecutar("SAVEPOINT caso");
      try { await accion(); console.log(`OK ${nombre}`); }
      catch (error) { fallos++; console.error(`FALLO ${nombre}: ${error.message}`); }
      finally { await ejecutar("ROLLBACK TO caso"); }
    };
    const esperar = async (ruta, credencial, status) => {
      const respuesta = await pedir(ruta, credencial);
      assert.equal(respuesta.status, status, `${ruta.method || 'GET'} ${ruta.path}: ${respuesta.texto.slice(0, 250)}`);
      return respuesta;
    };
    const datosUsuario = { nombreCompleto: "Prueba", nombreUsuario: marca + '_N', correo: marca + '@example.invalid', contrasena: "PruebaTemporal!123", idRol: rol };
    const datosProducto = { codigo: marca + '_N', nombre: "Prueba", precio: 1, stock: 0, idCategoria: categoria };
    const rutas = [
      { codigo: codigos[0], path: "/usuarios" },
      { codigo: codigos[0], path: "/usuarios/roles-asignables" },
      { codigo: codigos[0], path: "/usuarios", method: "POST", body: datosUsuario, ok: 201 },
      { codigo: codigos[0], path: `/usuarios/${usuario}`, method: "PUT", body: { nombreCompleto: "Actualizado", correo: marca + '@example.invalid', idRol: rol } },
      { codigo: codigos[0], path: `/usuarios/${usuario}/estado`, method: "PATCH", body: { estado: "I" }, admin: true },
      { codigo: codigos[1], path: "/roles" },
      { codigo: codigos[1], path: "/roles/permisos" },
      { codigo: codigos[1], path: `/roles/${rol}/permisos` },
      { codigo: codigos[1], path: `/roles/${rol}/permisos`, method: "PUT", body: { permisos: [ids.CLIENTES_VER] }, admin: true },
      { codigo: codigos[2], path: "/clientes" },
      { codigo: codigos[3], path: "/clientes", method: "POST", body: { nombres: "Prueba" }, ok: 201 },
      { codigo: codigos[4], path: `/clientes/${cliente}`, method: "PUT", body: { nombres: "Prueba editada" } },
      { codigo: codigos[4], path: `/clientes/${cliente}/estado`, method: "PATCH", body: { estado: "I" } },
      { codigo: codigos[5], path: "/productos" },
      { codigo: codigos[5], path: "/categorias" },
      { codigo: codigos[6], path: "/productos", method: "POST", body: datosProducto, ok: 201 },
      { codigo: codigos[6], path: "/categorias", method: "POST", body: { nombre: marca + '_N' }, ok: 201 },
      { codigo: codigos[7], path: `/productos/${producto}`, method: "PUT", body: datosProducto },
      { codigo: codigos[7], path: `/productos/${producto}/estado`, method: "PATCH", body: { estado: "I" } }
    ];
    for (const ruta of rutas) {
      const nombre = `${ruta.codigo} ${ruta.method || 'GET'} ${ruta.path}`;
      await comprobar(nombre + " autorizado", async () => { await asignar([ruta.codigo]); await esperar(ruta, ruta.admin ? adminToken : token, ruta.ok || 200); });
      await comprobar(nombre + " sin permiso 403", async () => { await asignar([]); await esperar(ruta, token, 403); });
      await comprobar(nombre + " claims de rol/permisos no elevan privilegios", async () => {
        await asignar([]);
        const claims = jwt.sign({ id: usuario, idRol: 1, rol: "Administrador", permisos: codigos }, process.env.JWT_SECRET, { expiresIn: "5m" });
        await esperar(ruta, claims, 403);
      });
      await comprobar(nombre + " sin token 401", () => esperar(ruta, null, 401));
      await comprobar(nombre + " token inválido 401", () => esperar(ruta, "invalido", 401));
      await comprobar(nombre + " expirado 401", () => esperar(ruta, firmar(usuario, { expiresIn: -1 }), 401));
      await comprobar(nombre + " usuario inactivo 403", async () => {
        await asignar([ruta.codigo]); await ejecutar("UPDATE USUARIOS SET ESTADO = 'I' WHERE ID_USUARIO = :id", { id: usuario }); await esperar(ruta, token, 403);
      });
      await comprobar(nombre + " rol inactivo 403", async () => {
        await asignar([ruta.codigo]); await ejecutar("UPDATE ROLES SET ESTADO = 'I' WHERE ID_ROL = :rol", { rol }); await esperar(ruta, token, 403);
      });
      await comprobar(nombre + " revocación sin nuevo login", async () => {
        await asignar([ruta.codigo]); await asignar([]); await esperar(ruta, token, 403);
        await asignar([ruta.codigo]); await esperar(ruta, ruta.admin ? adminToken : token, ruta.ok || 200);
      });
    }
    await comprobar("combinación consulta clientes/productos", async () => {
      await asignar(["CLIENTES_VER", "PRODUCTOS_VER"]);
      for (const ruta of rutas) await esperar(ruta, token, ["CLIENTES_VER", "PRODUCTOS_VER"].includes(ruta.codigo) ? 200 : 403);
    });
    await comprobar("escalamiento: cuenta secundaria administradora", async () => {
      await asignar(["USUARIOS_GESTIONAR"]);
      await esperar({ path: "/usuarios", method: "POST", body: { ...datosUsuario, idRol: 1 } }, token, 403);
    });
    await comprobar("escalamiento: cambiar propio rol", async () => {
      await asignar(["USUARIOS_GESTIONAR"]);
      await esperar({ path: `/usuarios/${usuario}`, method: "PUT", body: { nombreCompleto: "Prueba", idRol: 1 } }, token, 403);
    });
    await comprobar("escalamiento: modificar administrador o su estado", async () => {
      await asignar(["USUARIOS_GESTIONAR"]);
      await esperar({ path: `/usuarios/${administrador}`, method: "PUT", body: { nombreCompleto: "Prueba", idRol: rol } }, token, 403);
      await esperar({ path: `/usuarios/${administrador}/estado`, method: "PATCH", body: { estado: "I" } }, token, 403);
    });
    await comprobar("escalamiento: campos de permisos y estado inyectados", async () => {
      await asignar(["USUARIOS_GESTIONAR"]);
      for (const campo of ["permisos", "estado", "ID_ROL"]) await esperar({ path: "/usuarios", method: "POST", body: { ...datosUsuario, [campo]: "A" } }, token, 403);
    });
    await comprobar("escalamiento: gestor no administrador cambia sus permisos", async () => {
      await asignar(["ROLES_GESTIONAR"]);
      await esperar({ path: `/roles/${rol}/permisos`, method: "PUT", body: { permisos: [ids.USUARIOS_GESTIONAR] } }, token, 403);
    });
    await comprobar("administrador: propio estado y permisos protegidos", async () => {
      await esperar({ path: `/usuarios/${administrador}/estado`, method: "PATCH", body: { estado: "I" } }, adminToken, 403);
      await esperar({ path: "/roles/1/permisos", method: "PUT", body: { permisos: [] } }, adminToken, 403);
    });
    await comprobar("cambio de rol usa asignaciones actuales, no JWT", async () => {
      await ejecutar("UPDATE USUARIOS SET ID_ROL = :rol WHERE ID_USUARIO = :id", { rol, id: administrador });
      await asignar([]); await esperar({ path: "/usuarios" }, adminToken, 403);
    });
    await comprobar("JWT algoritmo, nbf, id y exp", async () => {
      for (const credencial of [jwt.sign({ id: usuario }, "firma-incorrecta", { expiresIn: "5m" }), firmar(usuario, { algorithm: "HS384" }), firmar(usuario, { notBefore: "1h" }), firmar("incorrecto"), jwt.sign({ id: usuario }, process.env.JWT_SECRET)]) {
        await esperar({ path: "/clientes" }, credencial, 401);
      }
    });
    await comprobar("login real y contraseña incorrecta", async () => {
      await esperar({ path: "/auth/login", method: "POST", body: { usuario: marca, contrasena: "PruebaTemporal!123" } }, null, 200);
      await esperar({ path: "/auth/login", method: "POST", body: { usuario: marca, contrasena: "incorrecta" } }, null, 401);
    });
    await comprobar("permisos de sesión actuales", async () => {
      await asignar(["CLIENTES_VER"]);
      let respuesta = await esperar({ path: "/auth/permisos" }, token, 200);
      assert.deepEqual(JSON.parse(respuesta.texto).permisos, ["CLIENTES_VER"]);
      await asignar(["PRODUCTOS_VER"]);
      respuesta = await esperar({ path: "/auth/permisos" }, token, 200);
      assert.deepEqual(JSON.parse(respuesta.texto).permisos, ["PRODUCTOS_VER"]);
    });
    await comprobar("asignar y revocar mediante API con el mismo JWT", async () => {
      const ruta = { path: `/roles/${rol}/permisos`, method: "PUT", body: { permisos: [ids.CLIENTES_VER] } };
      await esperar(ruta, adminToken, 200);
      await esperar({ path: "/clientes" }, token, 200);
      await esperar({ ...ruta, body: { permisos: [] } }, adminToken, 200);
      await esperar({ path: "/clientes" }, token, 403);
    });
    await comprobar("crear productos sin permiso de consulta permite catálogo de categorías", async () => {
      await asignar(["PRODUCTOS_CREAR"]);
      await esperar({ path: "/categorias" }, token, 200);
      await esperar({ path: "/productos" }, token, 403);
    });
    await comprobar("activar clientes y productos con permiso específico", async () => {
      await asignar(["CLIENTES_EDITAR", "PRODUCTOS_EDITAR"]);
      await esperar({ path: `/clientes/${cliente}/estado`, method: "PATCH", body: { estado: "A" } }, token, 200);
      await esperar({ path: `/productos/${producto}/estado`, method: "PATCH", body: { estado: "A" } }, token, 200);
    });
    await comprobar("escrituras autorizadas verificadas en la base de datos", async () => {
      await asignar(["CLIENTES_EDITAR", "PRODUCTOS_EDITAR", "USUARIOS_GESTIONAR"]);
      await esperar({ path: `/clientes/${cliente}`, method: "PUT", body: { nombres: "Nombre verificado" } }, token, 200);
      assert.equal((await ejecutar("SELECT NOMBRES FROM CLIENTES WHERE ID_CLIENTE = :id", { id: cliente })).rows[0].NOMBRES, "Nombre verificado");
      await esperar({ path: `/productos/${producto}`, method: "PUT", body: { ...datosProducto, precio: 12.5 } }, token, 200);
      assert.equal((await ejecutar("SELECT PRECIO FROM PRODUCTOS WHERE ID_PRODUCTO = :id", { id: producto })).rows[0].PRECIO, 12.5);
      await esperar({ path: `/usuarios/${usuario}`, method: "PUT", body: { nombreCompleto: "Nombre verificado", correo: marca + '@example.invalid', idRol: rol } }, token, 200);
      assert.equal((await ejecutar("SELECT NOMBRE_COMPLETO FROM USUARIOS WHERE ID_USUARIO = :id", { id: usuario })).rows[0].NOMBRE_COMPLETO, "Nombre verificado");
    });
    await comprobar("login de usuario o rol inactivo", async () => {
      const ruta = { path: "/auth/login", method: "POST", body: { usuario: marca, contrasena: "PruebaTemporal!123" } };
      await ejecutar("UPDATE USUARIOS SET ESTADO = 'I' WHERE ID_USUARIO = :id", { id: usuario });
      await esperar(ruta, null, 403);
      await ejecutar("UPDATE USUARIOS SET ESTADO = 'A' WHERE ID_USUARIO = :id", { id: usuario });
      await ejecutar("UPDATE ROLES SET ESTADO = 'I' WHERE ID_ROL = :rol", { rol });
      await esperar(ruta, null, 403);
    });
    for (const codigo of codigos.slice(8)) console.log(`PENDIENTE ${codigo}: módulo sin implementar; no se prueba como funcionalidad existente`);
    console.log(`RESULTADO: ${total - fallos}/${total} casos aprobados; ${fallos} fallos`);
    if (fallos) process.exitCode = 1;
  } catch (error) {
    console.error("Integración incompleta:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    db.getConnection = getConnection;
    if (servidor) await new Promise(resolve => servidor.close(resolve));
    if (conexion) { await conexion.rollback(); await conexion.close(); console.log("ROLLBACK final ejecutado"); }
  }
}
main();
