import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, ShieldCheck, Save, Lock } from "lucide-react";
import { soloAdmin } from "../services/acceso";
import api from "../services/api";

function RolesPermisos({ token, onVolver, puedeAdministrar = false }) {
  const [roles, setRoles] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [rolSeleccionado, setRolSeleccionado] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const config = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token],
  );

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resRoles, resPermisos] = await Promise.all([
          api.get("/roles", config),
          api.get("/roles/permisos", config),
        ]);

        setRoles(resRoles.data);
        setPermisos(resPermisos.data);

        const empleado = resRoles.data.find((r) => r.NOMBRE === "Empleado");

        if (empleado) {
          setRolSeleccionado(String(empleado.ID_ROL));
        } else if (resRoles.data.length > 0) {
          setRolSeleccionado(String(resRoles.data[0].ID_ROL));
        }
      } catch (err) {
        setError(err.response?.data?.mensaje || "Error al cargar roles y permisos");
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, [config]);

  useEffect(() => {
    if (!rolSeleccionado) return;

    let vigente = true;

    const cargarPermisosRol = async () => {
      setError("");
      setMensaje("");
      setCargando(true);

      try {
        const respuesta = await api.get(`/roles/${rolSeleccionado}/permisos`, config);

        if (vigente) {
          setSeleccionados(respuesta.data.map((p) => p.ID_PERMISO));
        }
      } catch (err) {
        if (vigente) {
          setError(err.response?.data?.mensaje || "No se pudieron consultar los permisos");
        }
      } finally {
        if (vigente) setCargando(false);
      }
    };

    cargarPermisosRol();

    return () => {
      vigente = false;
    };
  }, [rolSeleccionado, config]);

  const alternarPermiso = (id) => {
    setSeleccionados((actual) =>
      actual.includes(id) ? actual.filter((p) => p !== id) : [...actual, id],
    );
  };

  const rolActual = roles.find((r) => String(r.ID_ROL) === rolSeleccionado);

  const esAdministrador = [1, 3].includes(rolActual?.ID_ROL);

  const guardarPermisos = async () => {
    setError("");
    setMensaje("");
    setGuardando(true);

    try {
      await api.put(`/roles/${rolSeleccionado}/permisos`, { permisos: seleccionados.filter(id => !soloAdmin.has(permisos.find(p => p.ID_PERMISO === id)?.CODIGO)) }, config);

      setMensaje("Permisos guardados correctamente");
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al guardar los permisos");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className="roles-page">
      <button className="btn-volver" onClick={onVolver}>
        <ArrowLeft size={18} /> Volver al menú
      </button>

      <div className="roles-header">
        <ShieldCheck size={35} color="#4f46e5" />

        <div>
          <h2>Gestión de Roles y Permisos</h2>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="alerta-exito" role="status">
          {mensaje}
        </div>
      )}

      <section className="roles-panel">
        <label htmlFor="rol">Seleccionar rol</label>

        <select
          id="rol"
          value={rolSeleccionado}
          onChange={(e) => { const rol=e.target.value;window.dispatchEvent(new CustomEvent("solicitar-salida",{detail:()=>setRolSeleccionado(rol)})); }}
        >
          {roles.map((rol) => (
            <option key={rol.ID_ROL} value={rol.ID_ROL}>
              {rol.NOMBRE}
            </option>
          ))}
        </select>

        <form key={rolSeleccionado} onSubmit={e => { e.preventDefault(); guardarPermisos(); }}>
        <h3>Permisos del rol</h3>

        {esAdministrador && (
          <div className="roles-advertencia">
            <Lock size={18} />
            Los permisos de {rolActual.NOMBRE} están protegidos y no pueden modificarse aquí.
          </div>
        )}

        {cargando ? (
          <p>Cargando permisos...</p>
        ) : (
          <div className="permisos-lista">
            {permisos.filter(p => esAdministrador || !soloAdmin.has(p.CODIGO)).map((permiso) => (
              <label key={permiso.ID_PERMISO} className="permiso-item">
                <input
                  type="checkbox"
                  checked={seleccionados.includes(permiso.ID_PERMISO)}
                  disabled={!puedeAdministrar || esAdministrador || guardando || Boolean(error)}
                  onChange={() => alternarPermiso(permiso.ID_PERMISO)}
                />

                <div>
                  <strong>{permiso.CODIGO}</strong>
                  <p>{permiso.DESCRIPCION}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {puedeAdministrar && !esAdministrador && (
          <button
            className="btn-primary"
            type="submit"
            disabled={guardando || cargando || Boolean(error) || !rolSeleccionado}
          >
            <Save size={18} />
            {guardando ? "Guardando..." : "Guardar permisos"}
          </button>
        )}
        </form>
      </section>
    </main>
  );
}

export default RolesPermisos;
