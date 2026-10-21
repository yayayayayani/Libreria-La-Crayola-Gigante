import { useEffect, useState } from "react";
import { permisosVisibles } from "./services/acceso";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Usuarios from "./pages/Usuarios";
import RolesPermisos from "./pages/RolesPermisos";
import Ventas from "./pages/Pedidos";
import { VENTAS_HABILITADAS } from "./features";
import Clientes from "./pages/Clientes";
import Productos from "./pages/Productos";
import ComprasInventario from "./pages/ComprasInventario";
import api from "./services/api";
import "./App.css";
import "./theme.css";
import './orden.css';

const permisosPagina = {
  ventas: "VENTAS_GESTIONAR",
  compras: ["PROVEEDORES_GESTIONAR", "COMPRAS_GESTIONAR", "INVENTARIO_VER", "INVENTARIO_GESTIONAR"],
  usuarios: "USUARIOS_GESTIONAR",
  roles: "ROLES_GESTIONAR",
  clientes: ["CLIENTES_VER", "CLIENTES_CREAR", "CLIENTES_EDITAR"],
  productos: ["PRODUCTOS_VER", "PRODUCTOS_CREAR", "PRODUCTOS_EDITAR"],
};

const claveSesion = "crayola.sesion";
const clavePagina = "crayola.pagina";
function leerSesion() {
  try {
    const datos = JSON.parse(sessionStorage.getItem(claveSesion));
    return typeof datos?.token === "string" && datos.token ? { token: datos.token } : null;
  } catch {
    return null;
  }
}
function leerPagina() {
  try {
    const pagina = sessionStorage.getItem(clavePagina);
    return Object.hasOwn(permisosPagina, pagina) ? pagina : "dashboard";
  } catch {
    return "dashboard";
  }
}
function guardarEnPestana(clave, valor) {
  try {
    if (valor === null) sessionStorage.removeItem(clave);
    else sessionStorage.setItem(clave, valor);
  } catch {
    // Si el navegador bloquea el almacenamiento, la sesión sigue en memoria.
  }
}

function App() {
  const [sesion, setSesion] = useState(leerSesion);
  const [identidad, setIdentidad] = useState(null);
  const [permisos, setPermisos] = useState([]);
  const [pagina, setPagina] = useState(leerPagina);
  const [cargando, setCargando] = useState(() => Boolean(sesion));
  const [error, setError] = useState("");

  const iniciarSesion = (datos) => {
    guardarEnPestana(claveSesion, JSON.stringify({ token: datos.token }));
    guardarEnPestana(clavePagina, null);
    setCargando(true);
    setIdentidad(null);
    setSesion(datos);
    setPagina("dashboard");
    setPermisos([]);
    setError("");
  };

  const cerrarSesion = () => {
    guardarEnPestana(claveSesion, null);
    guardarEnPestana(clavePagina, null);
    setSesion(null);
    setIdentidad(null);
    setCargando(false);
    setPermisos([]);
    setPagina("dashboard");
    setError("");
  };

  useEffect(() => {
    if (!sesion?.token) return;

    let vigente = true;

    let consultando = false;
    const consultarPermisos = async () => {
      if (consultando) return;
      consultando = true;

      try {
        const respuesta = await api.get("/auth/permisos", {
          headers: {
            Authorization: `Bearer ${sesion.token}`,
          },
        });

        if (vigente) {
          setPermisos(permisosVisibles(respuesta.data.usuario?.idRol, respuesta.data.permisos));
          setIdentidad(respuesta.data.usuario);
          setError("");
        }
      } catch (err) {
        if (vigente) {
          if (err.response?.status === 401) {
            cerrarSesion();
            return;
          }
          setPermisos([]);
          setIdentidad(null);
          setError(err.response?.data?.mensaje || "No se pudieron consultar los permisos");
        }
      } finally {
        consultando = false;
        if (vigente) setCargando(false);
      }
    };

    consultarPermisos();
    const intervalo = window.setInterval(consultarPermisos, 15000);
    window.addEventListener("focus", consultarPermisos);
    window.addEventListener("permisos-actualizados", consultarPermisos);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", consultarPermisos);
      window.removeEventListener("permisos-actualizados", consultarPermisos);
      vigente = false;
    };
  }, [sesion?.token]);

  if (!sesion) {
    return <Login onLogin={iniciarSesion} />;
  }

  if (cargando) {
    return (
      <div className="container">
        <p>Consultando permisos del usuario...</p>
      </div>
    );
  }

  if (error) {
    return (
      <main className="container">
        <div className="panel">
          <p role="alert">{error}</p>
          <button onClick={cerrarSesion}>Volver al inicio de sesión</button>
        </div>
      </main>
    );
  }

  const autorizado = (codigo) =>
    (Array.isArray(codigo) ? codigo : [codigo]).some((p) => permisos.includes(p));

  const navegar = (destino) => {
    const permiso = permisosPagina[destino];

    if (!permiso || autorizado(permiso)) {
      guardarEnPestana(clavePagina, destino);
      setPagina(destino);
    }
  };

  const volver = () => {
    guardarEnPestana(clavePagina, null);
    setPagina("dashboard");
  };

  if (VENTAS_HABILITADAS && pagina === "ventas" && autorizado("VENTAS_GESTIONAR"))
    return <Ventas token={sesion.token} permisos={permisos} onVolver={volver} />;

  if (pagina === "compras" && autorizado(permisosPagina.compras))
    return <ComprasInventario token={sesion.token} permisos={permisos} onVolver={volver} />;

  if (pagina === "usuarios" && autorizado("USUARIOS_GESTIONAR")) {
    return <Usuarios identidad={identidad} token={sesion.token} onVolver={volver} />;
  }

  if (pagina === "roles" && autorizado("ROLES_GESTIONAR")) {
    return (
      <RolesPermisos
        puedeAdministrar={[1, 3].includes(identidad?.idRol)}
        token={sesion.token}
        onVolver={volver}
      />
    );
  }

  if (pagina === "clientes" && autorizado(permisosPagina.clientes)) {
    return <Clientes permisos={permisos} token={sesion.token} onVolver={volver} />;
  }

  if (pagina === "productos" && autorizado(permisosPagina.productos)) {
    return <Productos permisos={permisos} token={sesion.token} onVolver={volver} />;
  }

  return (
    <Dashboard
      token={sesion.token}
      usuario={{ ...sesion.usuario, ...identidad }}
      permisos={permisos}
      onLogout={cerrarSesion}
      onUsuarios={() => navegar("usuarios")}
      onRoles={() => navegar("roles")}
      onClientes={() => navegar("clientes")}
      onProductos={() => navegar("productos")}
      onVentas={() => navegar("ventas")}
      onCompras={() => navegar("compras")}
    />
  );
}

export default App;
