import { Download } from 'lucide-react';
import { descargarCsv } from '../services/descargas';

export default function ExportarCsv({ filas, nombre, columnas, disabled = false, alcance = 'registros mostrados' }) {
  return <div className="exportar-reporte">
    <button type="button" className="btn-secondary" disabled={disabled || !filas.length}
      onClick={() => descargarCsv(filas, nombre, columnas)}>
      <Download size={16} aria-hidden="true" /> Descargar CSV
    </button>
    <small>{filas.length} {alcance}</small>
  </div>;
}
