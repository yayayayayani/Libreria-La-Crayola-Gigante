
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Pencil, Save, Search } from "lucide-react";
import api from "../services/api";
import useActualizacion from '../hooks/useActualizacion';

const inicial = {
  nombres: "",
  apellidos: "",
  nit: "",
  telefono: "",
  correo: "",
  direccion: ""
};

function Clientes({ token, onVolver, permisos = [] }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(inicial);
  const [editando, setEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const puedeVer = permisos.includes("CLIENTES_VER");
  const puedeCrear = permisos.includes("CLIENTES_CREAR");
  const puedeEditar = permisos.includes("CLIENTES_EDITAR");

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const cargarClientes = async () => {
    if (!puedeVer) { setClientes([]); return; }
    try {
      const respuesta = await api.get("/clientes", config);
      setClientes(respuesta.data);
    } catch (err) {
      setError(err.response?.data?.mensaje ||
        "Error al consultar clientes");
    }
  };

  useActualizacion(cargarClientes);
  useEffect(() => {
    if (!puedeVer) return;
    let vigente = true;
    api.get("/clientes", { headers: { Authorization: `Bearer ${token}` } })
      .then(respuesta => { if (vigente) setClientes(respuesta.data); })
      .catch(err => { if (vigente) setError(err.response?.data?.mensaje || "Error al consultar clientes"); });
    return () => { vigente = false; };
  }, [token, puedeVer]);

  const nuevoCliente = () => {
    if (!puedeCrear) return;
    setFormulario({ ...inicial });
    setEditando(null);
    setError("");
    setMensaje("");
    setMostrarFormulario(true);
  };

  const editarCliente = (cliente) => {
    setFormulario({
      nombres: cliente.NOMBRES || "",
      apellidos: cliente.APELLIDOS || "",
      nit: cliente.NIT || "",
      telefono: cliente.TELEFONO || "",
      correo: cliente.CORREO || "",
      direccion: cliente.DIRECCION || ""
    });

    setEditando(cliente.ID_CLIENTE);
    setError("");
    setMensaje("");
    setMostrarFormulario(true);
  };

  const guardarCliente = async (e) => {
    e.preventDefault();

    setCargando(true);
    setError("");
    setMensaje("");

    try {
      if (editando !== null) {
        await api.put(
          `/clientes/${editando}`,
          formulario,
          config
        );
        setMensaje("Cliente actualizado correctamente");
      } else {
        await api.post("/clientes", formulario, config);
        setMensaje("Cliente registrado correctamente");
      }

      setMostrarFormulario(false);
      await cargarClientes();

    } catch (err) {
      setError(err.response?.data?.mensaje ||
        "Error al guardar cliente");
    } finally {
      setCargando(false);
    }
  };

  const cambiarEstado = async (cliente) => {
    const estado = cliente.ESTADO === "A" ? "I" : "A";

    if (!window.confirm("¿Confirmas cambiar el estado del cliente?")) {
      return;
    }

    setError("");
    setMensaje("");

    try {
      await api.patch(
        `/clientes/${cliente.ID_CLIENTE}/estado`,
        { estado },
        config
      );

      setMensaje("Estado actualizado correctamente");
      await cargarClientes();
    } catch (err) {
      setError(err.response?.data?.mensaje ||
        "Error al cambiar estado");
    }
  };

  const filtrados = clientes.filter((c) =>
    `${c.NOMBRES} ${c.APELLIDOS || ""} ${c.NIT || ""}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  const campos = [
    ["nombres", "Nombres", true],
    ["apellidos", "Apellidos", false],
    ["nit", "NIT", false],
    ["telefono", "Teléfono", false],
    ["correo", "Correo electrónico", false],
    ["direccion", "Dirección", false]
  ];

  return (
    <main className="usuarios-page">
      <div className="usuarios-top">
        <div>
          <button className="btn-volver" onClick={onVolver}>
            <ArrowLeft size={18}/> Volver al menú
          </button>
          <h2>Gestión de Clientes</h2>
          <p>Administración de clientes de la librería</p>
        </div>

        {puedeCrear && <button className="btn-primary" onClick={nuevoCliente}>
          <Plus size={18}/> Nuevo cliente
        </button>}
      </div>

      {mensaje && (
        <div className="alerta-exito" role="status">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {mostrarFormulario && (editando !== null ? puedeEditar : puedeCrear) && (
        <section className="form-panel">
          <h3>{editando !== null
            ? "Modificar cliente"
            : "Registrar cliente"}
          </h3>

          <form className="usuario-form" onSubmit={guardarCliente}>
            {campos.map(([campo, titulo, obligatorio]) => (
              <label key={campo}>
                {titulo}
                <input
                  type={campo === "correo" ? "email" : "text"}
                  value={formulario[campo]}
                  maxLength={campo === 'direccion' ? 250 : campo === 'correo' ? 120 : campo === 'nit' ? 14 : campo === 'telefono' ? 25 : 100}
                  pattern={['nombres','apellidos'].includes(campo) ? "[\\p{L}\\p{M}]+(?:[ '\u2019\\-][\\p{L}\\p{M}]+)*" : campo === 'nit' ? '(?:[1-9][0-9]{0,10}\\-?[0-9Kk]|[0-9]{13})' : undefined}
                  title={campo === 'nit' ? 'NIT tradicional o identificador de 13 dígitos' : ['nombres','apellidos'].includes(campo) ? 'Solo letras y separadores de nombres; sin números' : undefined}
                  required={obligatorio}
                  onChange={(e) => setFormulario({
                    ...formulario,
                    [campo]: e.target.value
                  })}
                />
              </label>
            ))}

            <div className="form-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setMostrarFormulario(false)}
              >
                Cancelar
              </button>

              <button
                className="btn-primary"
                type="submit"
                disabled={cargando}
              >
                <Save size={17}/>
                {cargando ? "Guardando..." : "Guardar cliente"}
              </button>
            </div>
          </form>
        </section>
      )}

      {puedeVer && <section className="usuarios-tabla-panel">
        <div className="buscar-campo">
          <Search size={19}/>
          <input
            placeholder="Buscar por nombre o NIT..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="tabla-scroll">
          <table className="usuarios-tabla">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>NIT</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtrados.map((cliente) => (
                <tr key={cliente.ID_CLIENTE}>
                  <td>{cliente.ID_CLIENTE}</td>
                  <td>
                    {cliente.NOMBRES} {cliente.APELLIDOS}
                  </td>
                  <td>{cliente.NIT || "—"}</td>
                  <td>{cliente.TELEFONO || "—"}</td>
                  <td>{cliente.CORREO || "—"}</td>
                  <td>
                    <span className={
                      cliente.ESTADO === "A"
                        ? "estado-activo"
                        : "estado-inactivo"
                    }>
                      {cliente.ESTADO === "A"
                        ? "Activo"
                        : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    {puedeEditar && <div className="acciones-usuario">
                      <button
                        className="btn-editar"
                        onClick={() => editarCliente(cliente)}
                        title="Editar cliente"
                      >
                        <Pencil size={16}/>
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => cambiarEstado(cliente)}
                      >
                        {cliente.ESTADO === "A"
                          ? "Desactivar"
                          : "Activar"}
                      </button>
                    </div>}
                  </td>
                </tr>
              ))}

              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="sin-datos">
                    No se encontraron clientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>}
    </main>
  );
}

export default Clientes;
