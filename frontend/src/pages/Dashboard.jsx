
import {
  BookOpen,
  Users,
  Package,
  ShieldCheck,
  LogOut
} from "lucide-react";

function Dashboard({
  usuario,
  permisos,
  onLogout,
  onUsuarios,
  onRoles,
  onClientes,
  onProductos
}) {
  const tienePermiso = (codigo) =>
    (Array.isArray(codigo) ? codigo : [codigo]).some(p => permisos.includes(p));

  return (
    <div className="dashboard">

      <header className="dashboard-header">
        <div>
          <h1>Librería La Crayola Gigante</h1>
          <p>Sistema de Gestión Administrativa</p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="logout-button"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </header>

      <main className="dashboard-main">
        <h2>¡Bienvenido, {usuario.nombre}!</h2>
        <p>Rol asignado: {usuario.rol}</p>

        <div className="modules-grid">

          {tienePermiso("USUARIOS_GESTIONAR") && (
            <button
              type="button"
              className="module-card module-button"
              onClick={onUsuarios}
            >
              <Users size={32} />
              <h3>Usuarios</h3>
              <p>Administración de usuarios</p>
            </button>
          )}

          {tienePermiso("ROLES_GESTIONAR") && (
            <button
              type="button"
              className="module-card module-button"
              onClick={onRoles}
            >
              <ShieldCheck size={32} />
              <h3>Roles y Permisos</h3>
              <p>Control de acceso al sistema</p>
            </button>
          )}

          {tienePermiso(["CLIENTES_VER", "CLIENTES_CREAR", "CLIENTES_EDITAR"]) && (
            <button
              type="button"
              className="module-card module-button"
              onClick={onClientes}
            >
              <BookOpen size={32} />
              <h3>Clientes</h3>
              <p>Gestión de clientes</p>
            </button>
          )}

          {tienePermiso(["PRODUCTOS_VER", "PRODUCTOS_CREAR", "PRODUCTOS_EDITAR"]) && (
            <button
              type="button"
              className="module-card module-button"
              onClick={onProductos}
            >
              <Package size={32} />
              <h3>Productos</h3>
              <p>Inventario y categorías</p>
            </button>
          )}

        </div>

        {permisos.length === 0 && (
          <p className="dashboard-notice">
            Tu usuario no tiene funciones asignadas.
            Contacta al administrador.
          </p>
        )}

      </main>
    </div>
  );
}

export default Dashboard;
