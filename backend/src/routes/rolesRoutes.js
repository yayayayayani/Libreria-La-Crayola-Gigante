
const express = require("express");

const {
  verificarToken,
  soloAdministrador
} = require("../middlewares/authMiddleware");

const {
  verificarPermiso
} = require("../middlewares/permisosMiddleware");

const {
  listarRoles,
  listarPermisos,
  permisosPorRol,
  actualizarPermisos
} = require("../controllers/rolesController");

const router = express.Router();

router.use(verificarToken);

router.get(
  "/",
  verificarPermiso("ROLES_GESTIONAR"),
  listarRoles
);

router.get(
  "/permisos",
  verificarPermiso("ROLES_GESTIONAR"),
  listarPermisos
);

router.get(
  "/:id/permisos",
  verificarPermiso("ROLES_GESTIONAR"),
  permisosPorRol
);

router.put(
  "/:id/permisos",
  soloAdministrador,
  verificarPermiso("ROLES_GESTIONAR"),
  actualizarPermisos
);

module.exports = router;
