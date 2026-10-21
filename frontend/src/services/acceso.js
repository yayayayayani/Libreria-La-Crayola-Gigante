export const soloAdmin = new Set(["FINANZAS_GESTIONAR", "REPORTES_VER", "BITACORA_VER", "COMPRAS_GESTIONAR", "PROVEEDORES_GESTIONAR", "USUARIOS_GESTIONAR", "ROLES_GESTIONAR", "PEDIDOS_APROBAR"]);
export const permisosVisibles = (rol, permisos) => permisos.filter(p => [1, 3].includes(rol) || !soloAdmin.has(p));
