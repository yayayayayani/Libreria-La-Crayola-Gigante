
import { useEffect, useState } from "react";
import {
  Plus, Pencil, Search, ArrowLeft, Save
} from "lucide-react";
import api from "../services/api";

const formularioVacio = {
  nombreCompleto: "",
  nombreUsuario: "",
  contrasena: "",
  idRol: ""
};

function Usuarios({ token, onVolver, identidad }) {
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(formularioVacio);
  const [editando, setEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const manejarError = (err) => {
    setError(
      err.response?.data?.mensaje ||
      "Error de comunicación con el servidor"
    );
  };

  const cargarUsuarios = async () => {
    try {
      const respuesta = await api.get("/usuarios", config);
      setUsuarios(respuesta.data);
    } catch (err) {
      manejarError(err);
    }
  };

  useEffect(() => {
    let vigente = true;
    const opciones = { headers: { Authorization: `Bearer ${token}` } };
    Promise.all([api.get("/usuarios", opciones), api.get("/usuarios/roles-asignables", opciones)])
      .then(([usuarios, roles]) => {
        if (vigente) { setUsuarios(usuarios.data); setRoles(roles.data); }
      }).catch(err => { if (vigente) setError(err.response?.data?.mensaje || "Error al consultar usuarios"); });
    return () => { vigente = false; };
  }, [token, identidad?.idRol]);

  const abrirNuevo = () => {
    setFormulario({ ...formularioVacio, idRol: roles[0]?.ID_ROL || "" });
    setEditando(null);
    setMensaje("");
    setError("");
    setMostrarFormulario(true);
  };

  const abrirEditar = (usuario) => {
    setFormulario({
      nombreCompleto: usuario.NOMBRE_COMPLETO,
      nombreUsuario: usuario.NOMBRE_USUARIO,
      contrasena: "",
      idRol: usuario.ID_ROL
    });
    setEditando(usuario.ID_USUARIO);
    setMensaje("");
    setError("");
    setMostrarFormulario(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    setCargando(true);

    try {
      if (editando !== null) {
        await api.put(
          `/usuarios/${editando}`,
          {
            nombreCompleto: formulario.nombreCompleto,
            idRol: Number(formulario.idRol)
          },
          config
        );

        setMensaje("Usuario actualizado correctamente");
      } else {
        await api.post(
          "/usuarios",
          {
            ...formulario,
            idRol: Number(formulario.idRol)
          },
          config
        );

        setMensaje("Usuario creado correctamente");
      }

      setMostrarFormulario(false);
      await cargarUsuarios();

    } catch (err) {
      manejarError(err);
    } finally {
      setCargando(false);
    }
  };

  const cambiarEstado = async (usuario) => {
    const nuevoEstado = usuario.ESTADO === "A" ? "I" : "A";

    const confirmado = window.confirm(
      `¿Deseas ${nuevoEstado === "A" ? "activar" : "desactivar"} a ${usuario.NOMBRE_COMPLETO}?`
    );

    if (!confirmado) return;

    setMensaje("");
    setError("");

    try {
      await api.patch(
        `/usuarios/${usuario.ID_USUARIO}/estado`,
        { estado: nuevoEstado },
        config
      );

      setMensaje("Estado actualizado correctamente");
      await cargarUsuarios();

    } catch (err) {
      manejarError(err);
    }
  };

  const filtrados = usuarios.filter((u) =>
    `${u.NOMBRE_COMPLETO} ${u.NOMBRE_USUARIO} ${u.ROL}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  return (
    <main className="usuarios-page">
      <div className="usuarios-top">
        <div>
          <button className="btn-volver" onClick={onVolver}>
            <ArrowLeft size={18} /> Volver al menú
          </button>
          <h2>Gestión de Usuarios</h2>
          <p>Administración del personal de la librería</p>
        </div>

        <button className="btn-primary" onClick={abrirNuevo}>
          <Plus size={18} /> Nuevo usuario
        </button>
      </div>

      {mensaje && (
        <div className="alerta-exito" role="status">{mensaje}</div>
      )}

      {error && (
        <div className="error-message" role="alert">{error}</div>
      )}

      {mostrarFormulario && (
        <div className="form-panel">
          <h3>
            {editando !== null ? "Modificar usuario" : "Nuevo usuario"}
          </h3>

          <form onSubmit={guardar} className="usuario-form">
            <label>
              Nombre completo
              <input
                value={formulario.nombreCompleto}
                maxLength={100}
                required
                onChange={(e) => setFormulario({
                  ...formulario,
                  nombreCompleto: e.target.value
                })}
              />
            </label>

            {!editando && (
              <>
                <label>
                  Nombre de usuario
                  <input
                    value={formulario.nombreUsuario}
                    maxLength={50}
                    required
                    onChange={(e) => setFormulario({
                      ...formulario,
                      nombreUsuario: e.target.value
                    })}
                  />
                </label>

                <label>
                  Contraseña
                  <input
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    value={formulario.contrasena}
                    onChange={(e) => setFormulario({
                      ...formulario,
                      contrasena: e.target.value
                    })}
                  />
                </label>
              </>
            )}

            <label>
              Rol
              <select
                required
                disabled={editando === identidad?.id}
                value={formulario.idRol}
                onChange={(e) => setFormulario({
                  ...formulario,
                  idRol: Number(e.target.value)
                })}
              >
                <option value="">Seleccionar rol</option>
                {roles.map(rol => <option key={rol.ID_ROL} value={rol.ID_ROL}>{rol.NOMBRE}</option>)}
              </select>
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMostrarFormulario(false)}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={cargando}
              >
                <Save size={17} />
                {cargando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="usuarios-tabla-panel">
        <div className="buscar-campo">
          <Search size={19} />
          <input
            placeholder="Buscar por nombre, usuario o rol..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="tabla-scroll">
          <table className="usuarios-tabla">
            <thead>
              <tr>
                <th>Nombre completo</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.ID_USUARIO}>
                  <td>{u.NOMBRE_COMPLETO}</td>
                  <td>{u.NOMBRE_USUARIO}</td>
                  <td>{u.ROL}</td>
                  <td>
                    <span className={
                      u.ESTADO === "A"
                        ? "estado-activo"
                        : "estado-inactivo"
                    }>
                      {u.ESTADO === "A" ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    {(identidad?.idRol === 1 || identidad?.idRol === u.ID_ROL) && <div className="acciones-usuario">
                      <button
                        className="btn-editar"
                        onClick={() => abrirEditar(u)}
                        aria-label={`Editar ${u.NOMBRE_USUARIO}`}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="btn-secondary"
                        disabled={u.ID_USUARIO === identidad?.id}
                        onClick={() => cambiarEstado(u)}
                      >
                        {u.ESTADO === "A" ? "Desactivar" : "Activar"}
                      </button>
                    </div>}
                  </td>
                </tr>
              ))}

              {filtrados.length === 0 && (
                <tr>
                  <td colSpan="5" className="sin-datos">
                    No hay usuarios para mostrar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default Usuarios;
