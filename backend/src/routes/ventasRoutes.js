const router = require("express").Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const { verificarPermiso } = require("../middlewares/permisosMiddleware");
const { conectar, filas } = require("../services/db");


router.use(verificarToken, verificarPermiso("VENTAS_GESTIONAR"));
// Alta desde caja: el vendedor puede registrar al comprador sin administrar clientes.
router.post('/clientes', require('../controllers/clientesController').crearCliente);
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
        "SELECT id_cliente,nombres,apellidos,nit,puntos FROM clientes WHERE estado='A' ORDER BY nombres",
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
        `SELECT id_venta,fecha,cliente_nombre,documento,total,iva_tasa,base_imponible,iva FROM ventas ${[1, 3].includes(req.usuario.ID_ROL) ? "" : "WHERE id_usuario=:usuario"} ORDER BY id_venta DESC`,
        [1, 3].includes(req.usuario.ID_ROL) ? {} : { usuario: req.usuario.ID_USUARIO },
      ),
    );
  }),
);
router.post("/", (req, res) => res.status(409).json({
  mensaje: "Registra un pedido y su pago para generar la salida de inventario.",
}));
module.exports = router;
