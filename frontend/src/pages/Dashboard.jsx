import CarnetEmpleado from "../components/CarnetEmpleado";
import Finanzas from "../components/Finanzas";
import { VENTAS_HABILITADAS } from "../features";
import { BookOpen, Users, Package, ShieldCheck, LogOut } from "lucide-react";

function Dashboard({
  token,
  usuario,
  permisos,
  onLogout,
  onUsuarios,
  onRoles,
  onClientes,
  onProductos,
  onCompras,
  onVentas,
}) {
  const tienePermiso = (codigo) =>
    (Array.isArray(codigo) ? codigo : [codigo]).some((p) => permisos.includes(p));

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Librería La Crayola Gigante</h1>
          <p>Sistema de Gestión Administrativa</p>
        </div>

        <button type="button" onClick={onLogout} className="logout-button">
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </header>

      <main className="dashboard-main">
        <div className="saludo-compacto"><h2>Hola, {usuario.nombre || usuario.rol}</h2><span className="role-pill">{usuario.rol}</span></div>
        {![1, 3].includes(usuario.idRol) && <CarnetEmpleado token={token} />}
        {[1, 3].includes(usuario.idRol) && <Finanzas token={token} />}
        <h2 className="titulo-modulos">Módulos</h2>

        <div className="modules-grid">
          {VENTAS_HABILITADAS && tienePermiso("VENTAS_GESTIONAR") && (
            <button type="button" className="module-card module-button" onClick={onVentas}>
              <BookOpen size={32} />
              <h3>Ventas a clientes</h3>
              <p>{[1, 3].includes(usuario.idRol) ? "Pedidos, aprobaciones, pagos y reportes" : "Tus ventas, cobros y comprobantes"}</p>
            </button>
          )}
          {tienePermiso([
            "PROVEEDORES_GESTIONAR",
            "COMPRAS_GESTIONAR",
            "INVENTARIO_VER",
            "INVENTARIO_GESTIONAR",
          ]) && (
            <button type="button" className="module-card module-button" onClick={onCompras}>
              <Package size={32} />
              <h3>{[1, 3].includes(usuario.idRol) ? "Compras e inventario" : "Inventario"}</h3>
              <p>{[1, 3].includes(usuario.idRol) ? "Proveedores, compras y movimientos" : "Existencias, movimientos y alertas"}</p>
            </button>
          )}

          {tienePermiso("USUARIOS_GESTIONAR") && (
            <button type="button" className="module-card module-button" onClick={onUsuarios}>
              <Users size={32} />
              <h3>Usuarios</h3>
              <p>Administración de usuarios</p>
            </button>
          )}

          {tienePermiso("ROLES_GESTIONAR") && (
            <button type="button" className="module-card module-button" onClick={onRoles}>
              <ShieldCheck size={32} />
              <h3>Roles y Permisos</h3>
              <p>Control de acceso al sistema</p>
            </button>
          )}

          {tienePermiso(["CLIENTES_VER", "CLIENTES_CREAR", "CLIENTES_EDITAR"]) && (
            <button type="button" className="module-card module-button" onClick={onClientes}>
              <BookOpen size={32} />
              <h3>Clientes</h3>
              <p>Gestión de clientes</p>
            </button>
          )}

          {tienePermiso(["PRODUCTOS_VER", "PRODUCTOS_CREAR", "PRODUCTOS_EDITAR"]) && (
            <button type="button" className="module-card module-button" onClick={onProductos}>
              <Package size={32} />
              <h3>Productos</h3>
              <p>Inventario y categorías</p>
            </button>
          )}
        </div>

        {permisos.length === 0 && (
          <p className="dashboard-notice">
            Tu usuario no tiene funciones asignadas. Contacta al administrador.
          </p>
        )}


      </main>
    </div>
  );
}

export default Dashboard;
