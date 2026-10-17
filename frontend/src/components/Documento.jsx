import { formatearDocumento } from "../services/documentos";
export default function Documento({ tipo, valor, onTipo, onValor, required = false }) {
  return (
    <>
      <label>
        Tipo de documento
        <select value={tipo} onChange={(e) => onTipo(e.target.value)}>
          <option value="NIT">NIT</option>
          <option value="DPI">DPI / CUI</option>
        </select>
      </label>
      <label>
        {tipo}
        <input
          aria-label={tipo}
          required={required}
          value={formatearDocumento(valor, tipo)}
          maxLength={tipo === "DPI" ? 13 : 9}
          inputMode={tipo === "DPI" ? "numeric" : "text"}
          pattern={tipo === "DPI" ? "[0-9]{13}" : "[0-9]{7}\\-?[0-9Kk]"}
          title={
            tipo === "DPI"
              ? "Exactamente 13 dígitos"
              : "El guion se coloca automáticamente antes del último carácter"
          }
          onChange={(e) => onValor(formatearDocumento(e.target.value, tipo))}
        />
        <small>
          {tipo === "DPI"
            ? "13 dígitos, sin espacios."
            : "Guion automático. Escribe el NIT sin guion; ejemplo: 12345678 → 1234567-8."}
        </small>
      </label>
    </>
  );
}
