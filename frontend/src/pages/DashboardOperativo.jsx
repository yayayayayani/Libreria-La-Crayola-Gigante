import { ArrowLeft, BarChart3 } from "lucide-react";
import ResumenOperativo from "../components/ResumenOperativo";

export default function DashboardOperativo({ token, permisos, onVolver }) {
  return <div className="dashboard">
    <header className="dashboard-header">
      <div><h1><BarChart3 size={26} aria-hidden="true" /> Dashboard</h1><p>Indicadores y seguimiento de la librería</p></div>
      <button type="button" className="logout-button" onClick={onVolver}><ArrowLeft size={18} /> Volver al inicio</button>
    </header>
    <main className="dashboard-main">
      <ResumenOperativo token={token} permisos={permisos} />
    </main>
  </div>;
}
