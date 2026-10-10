
const express = require("express");

const {
  verificarToken
} = require("../middlewares/authMiddleware");

const {
  verificarPermiso
} = require("../middlewares/permisosMiddleware");

const {
  listarClientes,
  crearCliente,
  modificarCliente,
  cambiarEstado
} = require("../controllers/clientesController");

const router = express.Router();

router.use(verificarToken);

router.get(
  "/",
  verificarPermiso("CLIENTES_VER"),
  listarClientes
);

router.post(
  "/",
  verificarPermiso("CLIENTES_CREAR"),
  crearCliente
);

router.put(
  "/:id",
  verificarPermiso("CLIENTES_EDITAR"),
  modificarCliente
);

router.patch(
  "/:id/estado",
  verificarPermiso("CLIENTES_EDITAR"),
  cambiarEstado
);

module.exports = router;
