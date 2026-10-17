const router = require("express").Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const { verificarPermiso } = require("../middlewares/permisosMiddleware");
const { conectar, filas, idSalida } = require("../services/db");
const { exigir, entero } = require("../services/validaciones");
const { validarCliente } = require("../controllers/clientesController");
router.use(verificarToken, verificarPermiso("VENTAS_GESTIONAR"));
const endpoint = (fn) => async (req, res) => {
  let c;
  try {
    c = await conectar();
    await fn(req, res, c);
  } catch (e) {
    if (c) await c.rollback();
    res
      .status(e.status || (e.errorNum === 1 ? 409 : 500))
      .json({
        mensaje: e.status
          ? e.message
          : e.errorNum === 1
            ? "La operación o el cliente ya existe. Revisa los datos antes de reintentar."
            : "No se pudo registrar la operación",
      });
  } finally {
    if (c) await c.close();
  }
};
router.get(
  "/catalogo",
  endpoint(async (req, res, c) => {
    res.json({
      productos: await filas(
        c,
        "SELECT id_producto,codigo,nombre,precio,stock FROM productos WHERE estado='A' ORDER BY nombre",
      ),
      clientes: await filas(
        c,
        "SELECT id_cliente,nombres,apellidos,nit FROM clientes WHERE estado='A' ORDER BY nombres",
      ),
    });
  }),
);
router.get(
  "/",
  endpoint(async (req, res, c) => {
    res.json(
      await filas(
        c,
        "SELECT id_venta,fecha,cliente_nombre,documento,total FROM ventas ORDER BY id_venta DESC",
      ),
    );
  }),
);
router.post(
  "/",
  (req, res, next) =>
    req.body?.modo === "nuevo" ? verificarPermiso("CLIENTES_CREAR")(req, res, next) : next(),
  endpoint(async (req, res, c) => {
    const b = req.body || {};
    exigir(["cf", "existente", "nuevo"].includes(b.modo), "Selecciona cliente o CF");
    exigir(
      typeof b.clave === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(b.clave),
      "Clave de operación inválida",
    );
    // Un reintento tras perder la respuesta devuelve la venta ya confirmada.
    const anterior = await filas(
      c,
      "SELECT id_venta,total FROM ventas WHERE clave=:clave AND id_usuario=:usuario",
      { clave: b.clave, usuario: req.usuario.ID_USUARIO },
    );
    if (anterior.length)
      return res.json({
        id: anterior[0].ID_VENTA,
        total: anterior[0].TOTAL,
        mensaje: "Venta registrada",
      });
    exigir(
      Array.isArray(b.detalles) && b.detalles.length > 0 && b.detalles.length <= 100,
      "Agrega entre 1 y 100 productos",
    );
    const ids = new Set();
    const detalles = b.detalles
      .map((d) => {
        exigir(
          d && entero(d.idProducto) && !ids.has(d.idProducto) && entero(d.cantidad, 1, 1000000),
          "Producto repetido o cantidad inválida",
        );
        ids.add(d.idProducto);
        return { idProducto: d.idProducto, cantidad: d.cantidad };
      })
      .sort((a, b) => a.idProducto - b.idProducto);
    let cliente = null,
      nombre = "Consumidor final",
      documento = "CF";
    if (b.modo === "existente") {
      exigir(entero(b.idCliente), "Selecciona un cliente");
      const rows = await filas(
        c,
        "SELECT * FROM clientes WHERE id_cliente=:id AND estado='A' FOR UPDATE",
        { id: b.idCliente },
      );
      exigir(rows.length, "Cliente inexistente o inactivo");
      cliente = b.idCliente;
      nombre = `${rows[0].NOMBRES} ${rows[0].APELLIDOS || ""}`.trim();
      documento = rows[0].NIT;
    } else if (b.modo === "nuevo") {
      const validado = validarCliente(b.cliente || {});
      exigir(!validado.error, validado.error);
      const datos = validado.cliente;
      const r = await c.execute(
        "INSERT INTO clientes(nombres,apellidos,nit,telefono,correo,direccion) VALUES (:nombres,:apellidos,:nit,:telefono,:correo,:direccion) RETURNING id_cliente INTO :id",
        { ...datos, id: idSalida() },
      );
      cliente = r.outBinds.id[0];
      nombre = `${datos.nombres} ${datos.apellidos || ""}`.trim();
      documento = datos.nit;
    }
    let centavos = 0;
    for (const d of detalles) {
      const rows = await filas(
        c,
        "SELECT precio,stock FROM productos WHERE id_producto=:id AND estado='A' FOR UPDATE",
        { id: d.idProducto },
      );
      exigir(rows.length, "Producto inexistente o inactivo");
      exigir(rows[0].STOCK >= d.cantidad, "Existencias insuficientes para completar la venta");
      d.precio = rows[0].PRECIO;
      d.anterior = rows[0].STOCK;
      centavos += Math.round(d.precio * 100) * d.cantidad;
    }
    exigir(
      Number.isSafeInteger(centavos) && centavos > 0 && centavos <= 999999999999,
      "Total fuera del límite permitido",
    );
    const total = centavos / 100;
    const r = await c.execute(
      "INSERT INTO ventas(id_cliente,id_usuario,cliente_nombre,documento,clave,total) VALUES (:cliente,:usuario,:nombre,:documento,:clave,:total) RETURNING id_venta INTO :id",
      {
        cliente,
        usuario: req.usuario.ID_USUARIO,
        nombre,
        documento,
        clave: b.clave,
        total,
        id: idSalida(),
      },
    );
    const id = r.outBinds.id[0];
    for (const d of detalles) {
      await c.execute(
        "INSERT INTO detalle_ventas(id_venta,id_producto,cantidad,precio) VALUES (:venta,:producto,:cantidad,:precio)",
        { venta: id, producto: d.idProducto, cantidad: d.cantidad, precio: d.precio },
      );
      await c.execute("UPDATE productos SET stock=stock-:cantidad WHERE id_producto=:producto", {
        cantidad: d.cantidad,
        producto: d.idProducto,
      });
      await c.execute(
        "INSERT INTO movimientos_inventario(id_producto,id_venta,id_usuario,tipo,cantidad,stock_anterior,stock_nuevo) VALUES (:producto,:venta,:usuario,'SALIDA_VENTA',:cantidad,:anterior,:nuevo)",
        {
          producto: d.idProducto,
          venta: id,
          usuario: req.usuario.ID_USUARIO,
          cantidad: d.cantidad,
          anterior: d.anterior,
          nuevo: d.anterior - d.cantidad,
        },
      );
    }
    await c.commit();
    res.status(201).json({ id, total, mensaje: "Venta registrada e inventario actualizado" });
  }),
);
module.exports = router;
