const SOLO_ADMIN = new Set([
  "FINANZAS_GESTIONAR", "REPORTES_VER", "BITACORA_VER",
  "COMPRAS_GESTIONAR", "PROVEEDORES_GESTIONAR",
  "USUARIOS_GESTIONAR", "ROLES_GESTIONAR", "PEDIDOS_APROBAR",
]);
const permisoVisible = (rol, codigo) => [1, 3].includes(rol) || !SOLO_ADMIN.has(codigo);
const soloAdministrador = (req, res, next) => [1, 3].includes(req.usuario?.ID_ROL)
  ? next() : res.status(403).json({ mensaje: "Esta función es exclusiva de administración" });
module.exports = { permisoVisible, soloAdministrador };
