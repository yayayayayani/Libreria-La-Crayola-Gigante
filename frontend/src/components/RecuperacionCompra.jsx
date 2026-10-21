import { useState } from "react";
import api from "../services/api";
const moneda = (n) => Number(n).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });
const tipos = { NOTA_CREDITO: "Nota de crédito", REEMBOLSO: "Reembolso recibido", PERDIDA: "Pérdida reconocida" };
const nuevaClave = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) => v.toString(16).padStart(2, "0")).join("");
export default function RecuperacionCompra({ detalle, token, onActualizar }) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ tipo: "NOTA_CREDITO", monto: "", referencia: "", fechaDocumento: "", observaciones: "" });
  const [clave, setClave] = useState(nuevaClave);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const saldo = detalle.saldoRechazos;
  if (!saldo || saldo.rechazado === 0) return null;
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const guardar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      await api.post(`/compras/${detalle.compra.ID_COMPRA}/recuperaciones`,
        { ...form, monto: Number(form.monto), clave },
        { headers: { Authorization: `Bearer ${token}` } });
      setMensaje("Resolución guardada en el historial de esta compra.");
      setAbierto(false);
      setClave(nuevaClave());
      setForm({ tipo: "NOTA_CREDITO", monto: "", referencia: "", fechaDocumento: "", observaciones: "" });
      await onActualizar();
    } catch (e) {
      setError(e.response?.data?.mensaje || "No se pudo actualizar la información. Consulta el detalle antes de reintentar.");
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="detalle-compra-importes" aria-label="Seguimiento del dinero rechazado">
      <h4>Saldo por productos rechazados</h4>
      <p>{saldo.pendiente > 0 ? "Hay un monto pendiente de resolver con el proveedor." : "El monto rechazado está completamente documentado."}</p>
      <div className="detalle-compra-resumen">
        <div className={saldo.pendiente > 0 ? "detalle-rechazadas" : ""}><span>Pendiente de recuperar</span><strong>{moneda(saldo.pendiente)}</strong></div>
        <div><span>Acreditado por el proveedor</span><strong>{moneda(saldo.acreditado)}</strong></div>
        <div><span>Dinero reembolsado</span><strong>{moneda(saldo.reembolsado)}</strong></div>
        <div><span>Pérdida reconocida</span><strong>{moneda(saldo.perdida)}</strong></div>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {mensaje && <p className="alerta-exito" role="status">{mensaje}</p>}
      {saldo.pendiente > 0 && !abierto && (
        <button type="button" className="btn-primary" disabled={ocupado} onClick={() => {
          setForm((f) => ({ ...f, monto: saldo.pendiente.toFixed(2) }));
          setAbierto(true);
        }}>Registrar resolución del saldo</button>
      )}
      {abierto && (
        <form onReset={()=>{setForm({ tipo: "NOTA_CREDITO", monto: "", referencia: "", fechaDocumento: "", observaciones: "" });setAbierto(false);}} onSubmit={guardar}>
          <fieldset disabled={ocupado} className="resolucion-form">
            <legend>Documento o comprobante del proveedor</legend>
            <div className="usuario-form">
              <label>Tipo de resolución<select value={form.tipo} onChange={cambiar("tipo")}>
                {Object.entries(tipos).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
              </select></label>
              <label>Monto a registrar (Q)<input type="number" min="0.01" max={saldo.pendiente} step="0.01" required value={form.monto} onChange={cambiar("monto")} /></label>
              <label>Número de nota, comprobante o autorización<input required maxLength={100} value={form.referencia} onChange={cambiar("referencia")} /></label>
              <label>Fecha del documento<input type="date" required value={form.fechaDocumento} onChange={cambiar("fechaDocumento")} /></label>
              <label>Observaciones {form.tipo === "PERDIDA" ? "(motivo obligatorio)" : "(opcional)"}
                <textarea rows={3} maxLength={500} required={form.tipo === "PERDIDA"} value={form.observaciones} onChange={cambiar("observaciones")} />
              </label>
            </div>
            <p>La nota de crédito no suma efectivo. Registra el dinero recibido también en Mi dinero.</p>
            <div className="form-actions">
              <button className="btn-primary">{ocupado ? "Guardando…" : "Guardar resolución"}</button>
              <button type="button" className="btn-secondary" onClick={() => setAbierto(false)}>Cancelar</button>
            </div>
          </fieldset>
        </form>
      )}
      <h4>Historial de resoluciones</h4>
      {!detalle.recuperaciones?.length ? <p>Aún no se han registrado notas de crédito, reembolsos o pérdidas.</p> : (
        <div className="tabla-scroll">
          <table className="usuarios-tabla">
            <thead><tr><th>Registro</th><th>Tipo</th><th>Monto</th><th>Referencia</th><th>Fecha del documento</th><th>Registrado por / fecha</th><th>Observaciones</th></tr></thead>
            <tbody>{detalle.recuperaciones.map((r) => <tr key={r.ID_RECUPERACION}>
              <td>#{r.ID_RECUPERACION}</td><td>{tipos[r.TIPO]}</td><td>{moneda(r.MONTO)}</td><td>{r.REFERENCIA}</td>
              <td>{r.FECHA_DOCUMENTO}</td><td>{r.REGISTRADO_POR}<br />{new Date(r.CREADO_EN).toLocaleString("es-GT", { timeZone: "America/Guatemala" })}</td>
              <td>{r.OBSERVACIONES || "Sin observaciones"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
