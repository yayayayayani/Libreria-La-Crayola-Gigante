const { protegerUsuarios } = require("../middlewares/usuariosSeguridad");

const express = require("express");

const {
  verificarToken
} = require("../middlewares/authMiddleware");

const {
  verificarPermiso
} = require("../middlewares/permisosMiddleware");

const {
  rolesAsignables,
  listarUsuarios,
  crearUsuario,
  modificarUsuario,
  cambiarEstado
} = require("../controllers/usuariosController");

const router = express.Router();

router.use(verificarToken);
router.get("/roles-asignables", verificarPermiso("USUARIOS_GESTIONAR"), rolesAsignables);

router.get(
  "/",
  verificarPermiso("USUARIOS_GESTIONAR"),
  listarUsuarios
);

router.post(
  "/",
  verificarPermiso("USUARIOS_GESTIONAR"),
  protegerUsuarios,
  crearUsuario
);

router.put(
  "/:id",
  verificarPermiso("USUARIOS_GESTIONAR"),
  protegerUsuarios,
  modificarUsuario
);

router.patch(
  "/:id/estado",
  verificarPermiso("USUARIOS_GESTIONAR"),
  protegerUsuarios,
  cambiarEstado
);

module.exports = router;
