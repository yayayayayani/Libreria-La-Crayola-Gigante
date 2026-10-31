import { useEffect, useState } from "react";
import { RefreshCw, CalendarDays, LayoutGrid, Rows3, Sparkles, ShoppingBag, Wallet, TrendingUp, Package, Users, TriangleAlert, FileDown, ShieldCheck, HelpCircle } from "lucide-react";
import GraficaInteractiva from "./GraficaInteractiva";
import { usePreferencia } from "../hooks/usePreferencia";
import { periodoRapido, fechaCorta } from "../services/graficas";
import api from "../services/api";
import ResultadoReporte from "./ResultadoReporte";
import PanelAuditoria from "./PanelAuditoria";
import { reportesVista } from "../services/reportesVista";
import "./ResumenOperativo.css";

const moneda = n => Number(n || 0).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });
const inicial = () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
};
export default function ResumenOperativo({ token, permisos }) {
  const reportes = permisos.includes("REPORTES_VER"), auditoria = permisos.includes("BITACORA_VER");
  const [fechas, setFechas] = useState(inicial), [filtro, setFiltro] = useState(inicial);
  const [datos, setDatos] = useState(null), [error, setError] = useState("");
  const [cargando, setCargando] = useState(reportes), [version, setVersion] = useState(0);
  const [tipo, setTipo] = useState("inventario"), [reporte, setReporte] = useState(null), [descargando, setDescargando] = useState(false);
  const [seccion, setSeccion] = useState(reportes ? "resumen" : "auditoria");
  const [vista, setVista] = usePreferencia("distribucion", "tarjetas", ["tarjetas", "amplia"]);
  const [ayuda, setAyuda] = useState(false);
  const [preset, setPreset] = useState("mes");
  const [actualizado, setActualizado] = useState(null);
  const aplicar = f => {
    if (!f.desde || !f.hasta || f.desde > f.hasta || (Date.parse(f.hasta) - Date.parse(f.desde)) / 86400000 > 366) {
      setError("Selecciona un rango válido de hasta 367 días."); return;
    }
    setCargando(reportes); setDatos(null); setFiltro({ ...f }); setReporte(null); setError("");
  };
  const cambiarSeccion = v => {
    if (v === seccion) return;
    setSeccion(v);
  };
  useEffect(() => {
    if (!reportes) return;
    const controller = new AbortController();
    api.get("/dashboard/resumen", { headers: { Authorization: `Bearer ${token}` }, params: filtro, signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) {
        if (!r.data?.indicadores) throw new Error("Respuesta inválida");
        setDatos(r.data); setActualizado(new Date());
      } })
      .catch(e => { if (!controller.signal.aborted) setError(e.response?.data?.mensaje || "No se pudo cargar el resumen operativo. Puedes reintentar."); })
      .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    return () => controller.abort();
  }, [token, filtro, version, reportes]);
  const consultar = async () => {
    setDescargando(true); setError(""); setReporte(null);
    const ruta = ["ventas", "productos"].includes(tipo) ? `/reportes/sprint3/${tipo}` : `/reportes/sprint4/${tipo}`;
    try {
      const r = await api.get(ruta, { headers: { Authorization: `Bearer ${token}` }, params: filtro });
      setReporte({ filas: r.data, tipo, ...filtro });
    } catch (e) { setError(e.response?.data?.mensaje || "No se pudo generar el reporte."); }
    finally { setDescargando(false); }
  };
  return <section className="resumen-operativo" aria-label="Resumen operativo">
    <header className="operativo-hero">
      <div><span className="panel-kicker"><Sparkles size={15} aria-hidden="true" /> EL PULSO DE TU LIBRERÍA</span><h2>Tu negocio, de un vistazo</h2><p>Elige un período, explora tus resultados y descubre qué necesita atención.</p></div>
      <div className="operativo-hero-acciones"><button type="button" aria-expanded={ayuda} onClick={() => setAyuda(v => !v)}><HelpCircle size={17} aria-hidden="true" /> Cómo usar el dashboard</button>
      <button type="button" disabled={cargando || descargando} onClick={() => { setCargando(reportes); setDatos(null); setError(""); setVersion(v => v + 1); }}><RefreshCw size={17} aria-hidden="true" /> Actualizar resumen</button></div>
    </header>
    {ayuda && <div className="operativo-guia"><h3>Empieza por aquí</h3><ol><li><b>Elige cuándo.</b> Usa un período rápido o indica fechas y pulsa Aplicar período.</li><li><b>Explora cómo.</b> Cambia el estilo de cada gráfica y toca sus datos para ver los valores.</li><li><b>Consulta o descarga.</b> En Reportes puedes exportar; en Auditoría puedes revisar quién hizo un cambio.</li></ol><p>Debajo de cada gráfica encontrarás una explicación para interpretarla.</p></div>}
    <div className="operativo-periodo">
      <div className="periodo-titulo"><CalendarDays size={20} aria-hidden="true" /><div><h3>¿Qué período quieres explorar?</h3><p>Las fechas filtran ventas y reportes. Las existencias y las alertas muestran el estado actual.</p></div></div>
      <div className="periodos-rapidos" role="group" aria-label="Períodos rápidos">{[["semana", "Últimos 7 días"], ["treinta", "Últimos 30 días"], ["mes", "Este mes"]].map(([v, titulo]) => {
        const f = periodoRapido(v, inicial().hasta);
        return <button type="button" key={v} disabled={descargando} aria-pressed={preset === v && filtro.desde === f.desde && filtro.hasta === f.hasta} onClick={() => { setPreset(v); setFechas(f); aplicar(f); }}>{titulo}</button>;
      })}</div>
      <form className="operativo-filtros" onSubmit={e => { e.preventDefault(); setPreset(null); aplicar(fechas); }}>
        <label>Desde (operación)<input required type="date" value={fechas.desde} onChange={e => setFechas({ ...fechas, desde: e.target.value })} /></label>
        <label>Hasta (operación)<input required type="date" value={fechas.hasta} onChange={e => setFechas({ ...fechas, hasta: e.target.value })} /></label>
        <button className="operativo-primario" disabled={descargando}>Aplicar período</button>
      </form>
      <div className="periodo-estado"><span>Período consultado: <b>{fechaCorta(filtro.desde)} {filtro.desde.slice(0, 4)} — {fechaCorta(filtro.hasta)} {filtro.hasta.slice(0, 4)}</b></span>
        {fechas.desde !== filtro.desde || fechas.hasta !== filtro.hasta ? <span className="periodo-pendiente">Fechas sin aplicar · pulsa Aplicar período</span> : actualizado && <span>Actualizado a las {actualizado.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}</span>}</div>
    </div>
    <nav className="operativo-navegacion" aria-label="Secciones del dashboard">
      {reportes && <button type="button" aria-pressed={seccion === "resumen"} onClick={() => cambiarSeccion("resumen")}><LayoutGrid size={18} aria-hidden="true" /> Resumen y gráficas</button>}
      {reportes && <button type="button" aria-pressed={seccion === "reportes"} onClick={() => cambiarSeccion("reportes")}><FileDown size={18} aria-hidden="true" /> Reportes</button>}
      {auditoria && <button type="button" aria-pressed={seccion === "auditoria"} onClick={() => cambiarSeccion("auditoria")}><ShieldCheck size={18} aria-hidden="true" /> Auditoría</button>}
    </nav>
    {error && <p role="alert" className="error-message">{error}</p>}
    {cargando && <p role="status">Consultando indicadores…</p>}
    {reportes && datos && seccion === "resumen" && <>
      <div className="operativo-seccion-titulo"><div><span className="panel-kicker">RESULTADOS DEL PERÍODO</span><h3>Lo más importante</h3></div><span>Solo ventas pagadas</span></div>
      <div className="operativo-indicadores">{[
        ["Ventas pagadas", datos.indicadores.VENTAS, "Pedidos con el pago completo.", ShoppingBag],
        ["Importe vendido", moneda(datos.indicadores.TOTAL), "Valor de los pedidos pagados; puede incluir puntos.", Wallet],
        ["Promedio por venta", moneda(datos.indicadores.TICKET_PROMEDIO), "Importe vendido dividido entre las ventas pagadas.", TrendingUp],
        ["Productos activos", datos.operacion.PRODUCTOS_ACTIVOS, "Productos habilitados actualmente.", Package],
        ["Clientes activos", datos.operacion.CLIENTES_ACTIVOS, "Clientes habilitados actualmente.", Users],
      ].map(([nombre, valor, explicacion, Icono], i) => <article key={nombre} className={i === 1 ? "indicador-principal" : ""}><div className="indicador-encabezado"><span>{nombre}</span><Icono size={19} aria-hidden="true" /></div><strong>{valor}</strong><p>{explicacion}</p></article>)}</div>
      <div className="operativo-alertas"><div className="operativo-seccion-titulo"><div><span className="panel-kicker">ESTADO ACTUAL</span><h3><TriangleAlert size={20} aria-hidden="true" /> Atención pendiente</h3></div><span>Independiente del período</span></div>
        <div className="alertas-grid"><article><strong>{datos.existencias.length}</strong><div><h4>{datos.existencias.length === 1 ? "Producto por reabastecer" : "Productos por reabastecer"}</h4><p>Existencias agotadas o por debajo del mínimo.</p></div></article>
        <article><strong>{datos.operacion.PEDIDOS_PENDIENTES}</strong><div><h4>Pedidos por aprobar</h4><p>Revisa las solicitudes en Ventas a clientes.</p></div></article>
        <article><strong>{datos.operacion.VENTAS_PENDIENTES}</strong><div><h4>Ventas pendientes de pago</h4><p>Consulta los cobros pendientes en Ventas a clientes.</p></div></article></div>
        {!!datos.existencias.length && <details><summary>Ver productos por reabastecer</summary><ul>{datos.existencias.map(p => <li key={p.ID_PRODUCTO}><b>{p.NOMBRE}</b><span>{p.STOCK} unidades disponibles · mínimo {p.STOCK_MINIMO}</span></li>)}</ul></details>}
        {!datos.existencias.length && <p className="alerta-correcta">No hay productos agotados ni por debajo de su mínimo.</p>}
      </div>
      <div className="operativo-seccion-titulo"><div><span className="panel-kicker">EXPLORA TUS DATOS</span><h3>Una vista para cada pregunta</h3><p>Cambia la gráfica y selecciona un dato para conocer su detalle.</p></div>
        <div className="vista-controles" role="group" aria-label="Distribución de gráficas"><button type="button" aria-pressed={vista === "tarjetas"} onClick={() => setVista("tarjetas")}><LayoutGrid size={16} aria-hidden="true" /> En tarjetas</button><button type="button" aria-pressed={vista === "amplia"} onClick={() => setVista("amplia")}><Rows3 size={16} aria-hidden="true" /> Vista amplia</button></div>
      </div>
      <div className={`operativo-graficas vista-${vista}`}><GraficaInteractiva key={`ventas-${filtro.desde}-${filtro.hasta}`} tipo="ventas" filas={datos.ventasPorDia} periodo={filtro} />
        <GraficaInteractiva key={`productos-${filtro.desde}-${filtro.hasta}`} tipo="productos" filas={datos.productos} periodo={filtro} /></div>
    </>}
    {reportes && seccion === "reportes" && <div className="operativo-reportes">
      <span className="panel-kicker">CONSULTA Y COMPARTE</span><h3>Tu información, lista para descargar</h3><p>Elige un reporte y pulsa Consultar reporte. Después podrás descargarlo en CSV o imprimirlo como PDF. El inventario siempre muestra las existencias actuales.</p><label>Tipo de reporte<select value={tipo} disabled={descargando} onChange={e => { setTipo(e.target.value); setReporte(null); }}>
        <option value="inventario">Inventario actual</option><option value="compras">Compras del período</option>
        <option value="ventas">Ventas del período</option><option value="productos">Productos vendidos del período</option>
      </select></label><button disabled={descargando} onClick={consultar}>{descargando ? "Consultando…" : "Consultar reporte"}</button>
      <div className="reporte-tipo-ayuda"><strong>¿Qué muestra este reporte?</strong><p>{reportesVista[tipo].descripcion}</p></div>
      {reporte && <ResultadoReporte key={`${reporte.tipo}-${reporte.desde}-${reporte.hasta}`} reporte={reporte} />}
    </div>}
    {auditoria && seccion === "auditoria" && <PanelAuditoria key={`${filtro.desde}-${filtro.hasta}`} token={token} periodo={filtro} version={version} />}
  </section>;
}
