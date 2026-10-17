import { useState } from "react";
import { BookOpen, LogIn, Eye, EyeOff } from "lucide-react";
import api from "../services/api";

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const iniciarSesion = async (e) => {
    e.preventDefault();
    setError("");

    if (!usuario.trim() || !contrasena) {
      setError("Completa todos los campos.");
      return;
    }

    setCargando(true);

    try {
      const respuesta = await api.post("/auth/login", {
        usuario: usuario.trim(),
        contrasena,
      });

      onLogin(respuesta.data);
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-container">
      <aside className="login-story">
        <span className="eyebrow">LA CRAYOLA GIGANTE</span>
        <h2>
          Un mundo de ideas.
          <br />
          <em>Todo en su lugar.</em>
        </h2>
        <p>Organiza tu librería, recibe nuevos productos y mantén cada existencia al día.</p>
        <div className="color-swatches" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <span>CREATIVIDAD QUE NOS UNE</span>
      </aside>
      <div className="login-card">
        <div className="logo">
          <BookOpen size={38} />
        </div>

        <h1>La Crayola Gigante</h1>
        <p>Sistema de Gestión para Librería</p>

        <h2>Bienvenido</h2>
        <p>Ingresa tus credenciales para continuar</p>

        <form onSubmit={iniciarSesion}>
          <label htmlFor="usuario">Nombre de usuario</label>
          <input
            id="usuario"
            type="text"
            placeholder="Ingresa tu usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="contrasena">Contraseña</label>

          <div className="password-container">
            <input
              id="contrasena"
              type={mostrar ? "text" : "password"}
              placeholder="Ingresa tu contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="toggle-password"
              onClick={() => setMostrar(!mostrar)}
              aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {mostrar ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <button className="login-button" type="submit" disabled={cargando}>
            <LogIn size={19} />
            {cargando ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <div className="login-footer">Librería La Crayola Gigante · Gestión administrativa</div>
      </div>
    </div>
  );
}

export default Login;
