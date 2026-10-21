import { useEffect, useState } from "react";
import api from "../services/api";
import { descargarCsv } from '../services/descargas';
import "./Finanzas.css";
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const moneda = n => Number(n || 0).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });
const metodos = { EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia" };
const categorias = { GASTO: "Gasto del negocio", COMPRA: "Pago a proveedor", RETIRO: "Retiro del propietario", OTRO_INGRESO: "Otro ingreso / devolución recibida", SALDO_INICIAL: "Saldo inicial" };
const nuevo = () => ({ categoria: "GASTO", metodo: "EFECTIVO", monto: "", fecha: hoy(), concepto: "", referencia: "", idCompra: "", clave: crypto.randomUUID() });
function periodo(tipo, fecha) {
  if (tipo === "dia") return { desde: fecha, hasta: fecha, pagina: 1 };
  const [y, m] = fecha.split("-").map(Number);
  if (tipo === "anio") return { desde: `${y}-01-01`, hasta: `${y}-12-31`, pagina: 1 };
  return { desde: `${fecha.slice(0, 7)}-01`, hasta: `${fecha.slice(0, 7)}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`, pagina: 1 };
}
export default function Finanzas({ token }) {
  const [referencia, setReferencia] = useState(hoy);
  const [filtro, cambiarFiltro] = useState(() => periodo("mes", hoy()));
  const [datos, setDatos] = useState(null), [compras, setCompras] = useState([]);
  const [form, setForm] = useState(nuevo), [anular, setAnular] = useState(null);
  const [motivo, setMotivo] = useState(""), [version, cambiarVersion] = useState(0);
  const [error, setError] = useState(""), [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true), [guardando, setGuardando] = useState(false);
  const setFiltro = valor => { setCargando(true); setError(""); cambiarFiltro(valor); };
  const setVersion = valor => { setCargando(true); setError(""); cambiarVersion(valor); };
  useEffect(() => {
    let vigente = true;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    Promise.all([api.get("/finanzas/resumen", { ...config, params: filtro }), api.get("/finanzas/compras-pendientes", config)])
      .then(([r, c]) => { if (vigente) { setDatos(r.data); setCompras(c.data); } })
      .catch(e => { if (vigente) { setDatos(null); setError(e.response?.data?.mensaje || "No se pudieron consultar las finanzas"); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token, filtro, version]);
  const guardar = async (e) => {
    e.preventDefault(); if (guardando) return;
    setGuardando(true); setError(""); setMensaje("");
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (anular) {
        await api.post(`/finanzas/movimientos/${anular}/anular`, { motivo }, config);
        setAnular(null); setMotivo(""); setMensaje("Movimiento anulado. Se conserva la auditoría.");
      } else {
        await api.post("/finanzas/movimientos", { ...form, monto: Number(form.monto), idCompra: form.categoria === "COMPRA" ? Number(form.idCompra) : null }, config);
        setForm(nuevo()); setMensaje("Movimiento registrado.");
      }
      setVersion(v => v + 1);
    } catch (err) { setError(err.response?.data?.mensaje || "No se recibió confirmación. Reintenta sin cambiar los datos."); }
    finally { setGuardando(false); }
  };
  const t = datos?.totales;
  const exportar=async()=>{
    setError('');setGuardando(true);
    try{const r=await api.get('/finanzas/exportar',{headers:{Authorization:`Bearer ${token}`},params:filtro});descargarCsv(r.data,`movimientos-${filtro.desde}-${filtro.hasta}.csv`);}
    catch{setError('No se pudo descargar el reporte');}finally{setGuardando(false);}
  };
  return <section className="finanzas" aria-label="Finanzas de administración">
    <header><div><span className="eyebrow">SOLO ADMINISTRACIÓN</span><h2>Mi dinero</h2></div><button onClick={() => setVersion(v => v + 1)} disabled={cargando}>Actualizar</button></header>
    <div className="finanzas-filtros">
      <button disabled={cargando||guardando||!t} onClick={exportar}>Descargar movimientos CSV</button>
      <label>Fecha de referencia<input type="date" required value={referencia} onChange={e => setReferencia(e.target.value)} /></label>
      <div className="finanzas-periodos">{[["dia", "Día"], ["mes", "Mes"], ["anio", "Año"]].map(([v, n]) => <button key={v} disabled={!referencia} onClick={() => setFiltro(periodo(v, referencia))}>{n}</button>)}</div>
      <label>Desde<input type="date" required value={filtro.desde} onChange={e => setFiltro({ ...filtro, desde: e.target.value, pagina: 1 })} /></label>
      <label>Hasta<input type="date" required value={filtro.hasta} onChange={e => setFiltro({ ...filtro, hasta: e.target.value, pagina: 1 })} /></label>
    </div>
    {error && <p role="alert" className="error-message">{error}</p>}
    {mensaje && <p role="status">{mensaje}</p>}
    {cargando ? <p role="status">Consultando movimientos…</p> : t && <>
      <div className="finanzas-totales">
        {[["Saldo disponible", t.SALDO, "saldo"], ["Ingresos del período", t.INGRESOS, "entrada"], ["Egresos del período", t.EGRESOS, "salida"], ["Balance del período", t.BALANCE, ""]].map(([n, v, c]) => <article key={n} className={c}><span>{n}</span><strong>{moneda(v)}</strong></article>)}
      </div>
      <details className="finanzas-desglose"><summary>Ver movimientos y saldos por método</summary>
      <div className="finanzas-metodos">{Object.entries(metodos).map(([m, n]) => {
        const d = datos.porMetodo.find(r => r.METODO === m) || {};
        return <article key={m}><h3>{n}</h3><p>Entró <strong>{moneda(d.INGRESOS)}</strong></p><p>Salió <strong>{moneda(d.EGRESOS)}</strong></p><p>Saldo <strong>{moneda(d.SALDO)}</strong></p></article>;
      })}</div>
      <details><summary>Resumen por día</summary><div className="tabla-scroll"><table><thead><tr><th>Fecha</th><th>Ingresos</th><th>Egresos</th><th>Balance</th></tr></thead><tbody>{datos.porDia.map(r => <tr key={r.FECHA}><td>{String(r.FECHA).slice(0, 10)}</td><td>{moneda(r.INGRESOS)}</td><td>{moneda(r.EGRESOS)}</td><td>{moneda(r.INGRESOS - r.EGRESOS)}</td></tr>)}</tbody></table></div></details>
      <h3>Movimientos del período</h3>
      <div className="tabla-scroll"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Método</th><th>Monto</th><th>Referencia</th><th>Acción</th></tr></thead><tbody>
        {datos.movimientos.map(r => <tr key={r.ID}><td>{String(r.FECHA).slice(0, 10)}</td><td>{r.TIPO}</td><td>{r.CONCEPTO}</td><td>{metodos[r.METODO]}</td><td>{moneda(r.MONTO)}</td><td>{r.REFERENCIA || "—"}</td><td>{r.ID_MANUAL ? <button onClick={() => { setAnular(r.ID_MANUAL); setMotivo(""); }}>Anular</button> : "Cobro de venta"}</td></tr>)}
        {!datos.movimientos.length && <tr><td colSpan="7">No hay movimientos en este período.</td></tr>}
      </tbody></table></div>
      <div className="finanzas-paginacion"><button disabled={filtro.pagina === 1} onClick={() => setFiltro({ ...filtro, pagina: filtro.pagina - 1 })}>Anterior</button><span>Página {filtro.pagina} · {datos.totalMovimientos} movimientos</span><button disabled={filtro.pagina * 50 >= datos.totalMovimientos} onClick={() => setFiltro({ ...filtro, pagina: filtro.pagina + 1 })}>Siguiente</button></div>
      </details>
    </>}
    {anular && <form onReset={()=>{setAnular(null);setMotivo("");}} className="finanzas-form" onSubmit={guardar}><h3>Anular movimiento #{anular}</h3><p>Corrige un registro equivocado; no representa una devolución de dinero.</p><label>Motivo de anulación<input required maxLength="250" value={motivo} onChange={e => setMotivo(e.target.value)} /></label><button disabled={guardando}>Confirmar anulación</button><button type="button" onClick={() => setAnular(null)}>Cancelar</button></form>}
    <details className="finanzas-registro"><summary>Registrar movimiento</summary>

      <form onReset={()=>setForm(nuevo())} className="finanzas-form" onSubmit={guardar}><fieldset disabled={guardando || !!anular}>
        <label>Tipo de movimiento<select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value, idCompra: "" })}>{Object.entries(categorias).map(([v, n]) => <option value={v} key={v}>{n}</option>)}</select></label>
        {form.categoria === "COMPRA" && <label>Compra pendiente<select required value={form.idCompra} onChange={e => setForm({ ...form, idCompra: e.target.value })}><option value="">Selecciona la compra</option>{compras.map(c => <option key={c.ID_COMPRA} value={c.ID_COMPRA}>#{c.ID_COMPRA} · {c.PROVEEDOR} · {c.FACTURA} · Pendiente {moneda(c.PENDIENTE)}</option>)}</select></label>}
        {form.categoria === "SALDO_INICIAL" && <p>Dinero disponible antes de empezar a registrar movimientos.</p>}
        <label>Método del movimiento<select value={form.metodo} onChange={e => setForm({ ...form, metodo: e.target.value })}>{Object.entries(metodos).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <label>Monto (Q)<input type="number" min="0.01" max="9999999999.99" step="0.01" required value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} /></label>
        <label>Fecha del movimiento<input type="date" required max={hoy()} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
        <label>Concepto<input required maxLength="250" value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} /></label>
        <label>Referencia<input maxLength="100" value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} /></label>
        <button className="btn-primary">{guardando ? "Registrando…" : "Registrar movimiento"}</button>
      </fieldset></form>
    </details>

  </section>;
}
