
const express = require("express");

const {
  verificarToken
} = require("../middlewares/authMiddleware");

const {
  verificarPermiso
} = require("../middlewares/permisosMiddleware");

const {
  listarProductos,
  crearProducto,
  modificarProducto,
  cambiarEstado
} = require("../controllers/productosController");

const router = express.Router();

router.use(verificarToken);

router.get(
  "/",
  verificarPermiso("PRODUCTOS_VER"),
  listarProductos
);

router.post(
  "/",
  verificarPermiso("PRODUCTOS_CREAR"),
  crearProducto
);

router.put(
  "/:id",
  verificarPermiso("PRODUCTOS_EDITAR"),
  modificarProducto
);

router.patch(
  "/:id/estado",
  verificarPermiso("PRODUCTOS_EDITAR"),
  cambiarEstado
);

module.exports = router;
