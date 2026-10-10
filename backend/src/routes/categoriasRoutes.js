
const express = require("express");

const {
  verificarToken
} = require("../middlewares/authMiddleware");

const {
  verificarPermiso
} = require("../middlewares/permisosMiddleware");

const {
  listarCategorias,
  crearCategoria
} = require("../controllers/categoriasController");

const router = express.Router();

router.use(verificarToken);

router.get(
  "/",
  verificarPermiso(["PRODUCTOS_VER", "PRODUCTOS_CREAR", "PRODUCTOS_EDITAR"]),
  listarCategorias
);

router.post(
  "/",
  verificarPermiso("PRODUCTOS_CREAR"),
  crearCategoria
);

module.exports = router;
