
import { useEffect, useState } from "react";
import { BookOpen, Database, CheckCircle } from "lucide-react";
import api from "./services/api";
import "./App.css";

function App() {
  const [estado, setEstado] = useState("Comprobando conexión...");
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    api.get("/")
      .then((respuesta) => {
        setEstado(respuesta.data.mensaje);
        setConectado(true);
      })
      .catch(() => {
        setEstado("No se pudo conectar con el backend");
      });
  }, []);

  return (
    <div className="container">
      <div className="panel">
        <BookOpen size={56} color="#6366f1" />

        <h1>Librería La Crayola Gigante</h1>

        <p>Sistema Web de Gestión Administrativa</p>

        <div className="estado">
          {conectado
            ? <CheckCircle color="#16a34a" />
            : <Database color="#64748b" />
          }

          <span>{estado}</span>
        </div>

        <p className="version">
          Sprint 1 — Versión inicial
        </p>
      </div>
    </div>
  );
}

export default App;
