const express = require("express");

const { verificarToken } = require("../middlewares/authMiddleware");

const { verificarPermiso } = require("../middlewares/permisosMiddleware");

const {
  listarProductos,
  crearProducto,
  modificarProducto,
  cambiarEstado,
} = require("../controllers/productosController");

const router = express.Router();

router.use(verificarToken);

router.get("/", verificarPermiso("PRODUCTOS_VER"), listarProductos);

router.post("/", verificarPermiso("PRODUCTOS_CREAR"), crearProducto);

router.put("/:id", verificarPermiso("PRODUCTOS_EDITAR"), modificarProducto);

router.patch("/:id/estado", verificarPermiso("PRODUCTOS_EDITAR"), cambiarEstado);

router.get(
  "/:id/imagen",
  verificarPermiso([
    "PRODUCTOS_VER",
    "PRODUCTOS_EDITAR",
    "COMPRAS_GESTIONAR",
    "INVENTARIO_VER",
    "INVENTARIO_GESTIONAR",
  ]),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1)
      return res.status(400).json({ mensaje: "ID inválido" });
    let c;
    try {
      const driver = require("../config/driver");
      c = await require("../services/db").conectar();
      const r = await c.execute(
        "SELECT contenido FROM imagenes_productos WHERE id_producto=:id",
        { id },
        {
          outFormat: driver.OUT_FORMAT_OBJECT,
          fetchInfo: { CONTENIDO: { type: require("oracledb").STRING } },
        },
      );
      res.set("Cache-Control", "private, no-store");
      res.set("X-Content-Type-Options", "nosniff");
      if (!r.rows.length) return res.status(204).end();
      res.type("image/webp").send(Buffer.from(r.rows[0].CONTENIDO, "base64"));
    } catch {
      res.status(500).json({ mensaje: "No se pudo consultar la imagen" });
    } finally {
      if (c) await c.close();
    }
  },
);
module.exports = router;
