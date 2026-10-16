
import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Usuarios from "./pages/Usuarios";
import RolesPermisos from "./pages/RolesPermisos";
import Clientes from "./pages/Clientes";
import Productos from "./pages/Productos";
import ComprasInventario from './pages/ComprasInventario';
import api from "./services/api";
import "./App.css";

const permisosPagina = {
  compras: ['PROVEEDORES_GESTIONAR','COMPRAS_GESTIONAR','INVENTARIO_VER','INVENTARIO_GESTIONAR'],
  usuarios: "USUARIOS_GESTIONAR",
  roles: "ROLES_GESTIONAR",
  clientes: ["CLIENTES_VER", "CLIENTES_CREAR", "CLIENTES_EDITAR"],
  productos: ["PRODUCTOS_VER", "PRODUCTOS_CREAR", "PRODUCTOS_EDITAR"]
};

function App() {
  const [sesion, setSesion] = useState(null);
  const [identidad, setIdentidad] = useState(null);
  const [permisos, setPermisos] = useState([]);
  const [pagina, setPagina] = useState("dashboard");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const iniciarSesion = (datos) => {
    setCargando(true);
    setIdentidad(null);
    setSesion(datos);
    setPagina("dashboard");
    setPermisos([]);
    setError("");
  };

  const cerrarSesion = () => {
    setSesion(null);
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
            Authorization: `Bearer ${sesion.token}`
          }
        });

        if (vigente) {
          setPermisos(respuesta.data.permisos);
          setIdentidad(respuesta.data.usuario);
          setError("");
        }
      } catch (err) {
        if (vigente) {
          setPermisos([]);
          setIdentidad(null);
          setError(
            err.response?.data?.mensaje ||
            "No se pudieron consultar los permisos"
          );
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
          <button onClick={cerrarSesion}>
            Volver al inicio de sesión
          </button>
        </div>
      </main>
    );
  }

  const autorizado = (codigo) =>
    (Array.isArray(codigo) ? codigo : [codigo]).some(p => permisos.includes(p));

  const navegar = (destino) => {
    const permiso = permisosPagina[destino];

    if (!permiso || autorizado(permiso)) {
      setPagina(destino);
    }
  };

  const volver = () => setPagina("dashboard");

  if(pagina === 'compras' && autorizado(permisosPagina.compras)) return <ComprasInventario token={sesion.token} permisos={permisos} onVolver={volver}/>;

  if (pagina === "usuarios" &&
      autorizado("USUARIOS_GESTIONAR")) {
    return (
      <Usuarios identidad={identidad} token={sesion.token} onVolver={volver} />
    );
  }

  if (pagina === "roles" &&
      autorizado("ROLES_GESTIONAR")) {
    return (
      <RolesPermisos
        puedeAdministrar={identidad?.idRol === 1}
        token={sesion.token}
        onVolver={volver}
      />
    );
  }

  if (pagina === "clientes" &&
      autorizado(permisosPagina.clientes)) {
    return (
      <Clientes permisos={permisos} token={sesion.token} onVolver={volver} />
    );
  }

  if (pagina === "productos" &&
      autorizado(permisosPagina.productos)) {
    return (
      <Productos permisos={permisos} token={sesion.token} onVolver={volver} />
    );
  }

  return (
    <Dashboard
      usuario={{ ...sesion.usuario, ...identidad }}
      permisos={permisos}
      onLogout={cerrarSesion}
      onUsuarios={() => navegar("usuarios")}
      onRoles={() => navegar("roles")}
      onClientes={() => navegar("clientes")}
      onProductos={() => navegar("productos")}
      onCompras={() => navegar('compras')}
    />
  );
}

export default App;
