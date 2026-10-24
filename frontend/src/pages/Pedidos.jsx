import ExportarCsv from "../components/ExportarCsv";
import { useState } from "react";
import ComprobanteVenta from "../components/ComprobanteVenta";
import api from "../services/api";
import useActualizacion from "../hooks/useActualizacion";
import { ShoppingBag, ArrowLeft, ClipboardList, Plus, Search, ShieldCheck, BarChart3 } from "lucide-react";
import "./Pedidos.css";
const dinero = (n) => Number(n).toFixed(2);
const estados = { APROBADO: "Aprobado", PENDIENTE_APROBACION: "Por aprobar", RECHAZADO: "Rechazado", CANCELADO: "Cancelado", VENDIDO: "Pendiente de pago", PAGADO: "Pagado" };
export default function Pedidos({ token, permisos, onVolver }) {
  const [vista,setVista] = useState("venta");
  const [comprobante, setComprobante] = useState(null);
  const [imprimirAutomatico, setImprimirAutomatico] = useState(true);
  const [catalogo, setCatalogo] = useState({ clientes: [], productos: [] });
  const [pedidos, setPedidos] = useState([]);
  const [form, setForm] = useState({ idCliente: "", descuento: 0, clave: crypto.randomUUID(), detalles: [{ idProducto: "", cantidad: 1 }] });
  const [filtros, setFiltros] = useState({ cliente: "", estado: "", desde: "", hasta: "", pagina: 1 });
  const [detalle, setDetalle] = useState(null), [motivo, setMotivo] = useState("");
  const [pago, setPago] = useState({ monto: "", metodo: "EFECTIVO", referencia: "", puntos: 0, recibido: "", clave: crypto.randomUUID() });
  const [reporte, setReporte] = useState(null), [auditoria, setAuditoria] = useState(null);
  const [ocupado, setOcupado] = useState(false), [error, setError] = useState(""), [mensaje, setMensaje] = useState("");
  const config = { headers: { Authorization: `Bearer ${token}` } };
  const puede = (p) => permisos.includes(p);
  const registrarCliente = async () => {
    const r = await api.post('/ventas/clientes', { nombres: form.nombre || '', nit: form.nit || '', tipoDocumento: 'NIT' }, config);
    const id = r.data.id;
    setForm(actual => ({...actual, idCliente: String(id), nombre:'',nit:''}));
    return id;
  };
  const cargar = async () => {
    const [c, p] = await Promise.all([api.get("/ventas/catalogo", config), api.get("/pedidos", { ...config, params: filtros })]);
    setCatalogo(c.data); setPedidos(p.data);
  };
  useActualizacion(async () => { try { await cargar(); } catch (e) { setError(e.response?.data?.mensaje || "No se pudo consultar"); } }, true);
  const ejecutar = async (fn) => {
    if (ocupado) return;
    setOcupado(true); setError(""); setMensaje("");
    try { await fn(); await cargar(); } catch (e) { setError(e.response?.data?.mensaje || "No se recibió confirmación. Reintenta la misma operación."); }
    finally { setOcupado(false); }
  };
  const verComprobante = async (id, automatico = false) => {
    try {
      const r = await api.get(`/pedidos/${id}/comprobante`, config);
      setComprobante({ documento: r.data, automatico });
    } catch {
      setError("El cobro permanece registrado. No se pudo abrir el comprobante; vuelve a consultarlo desde la lista.");
    }
  };
  const accion = (id, ruta, datos = {}) => ejecutar(async () => {
    const r = await api.post(`/pedidos/${id}/${ruta}`, datos, config);
    setMensaje(r.data.mensaje || "Operación registrada"); setDetalle(null);
    if (ruta === "pagos" && r.data.completo) await verComprobante(id, imprimirAutomatico);
  });
  const abrir = (p) => ejecutar(async () => {
    const r = await api.get(`/pedidos/${p.ID_PEDIDO}`, config); setDetalle(r.data); setMotivo("");
    setPago({ monto: dinero(p.TOTAL - p.PAGADO), metodo: "EFECTIVO", referencia: "", puntos: 0, recibido: "", clave: crypto.randomUUID() });
  });
  const linea = (i, campo, valor) => setForm({ ...form, detalles: form.detalles.map((d, j) => i === j ? { ...d, [campo]: valor } : d) });
  const subtotal = form.detalles.reduce((n, d) => n + Math.round((catalogo.productos.find((p) => p.ID_PRODUCTO === Number(d.idProducto))?.PRECIO || 0) * 100) * Number(d.cantidad || 0), 0) / 100;
  const total = Math.round(subtotal * 100 * (10000 - Math.round(Number(form.descuento || 0) * 100)) / 10000) / 100;
  const baseImponible = Math.round(Math.round(total * 100) * 100 / 112) / 100;
  const ivaIncluido = (Math.round(total * 100) - Math.round(baseImponible * 100)) / 100;
  const pendienteCobro = detalle ? (Math.round(Number(detalle.pedido.TOTAL) * 100) - detalle.pagos.reduce((n, p) => n + Math.round(Number(p.MONTO) * 100), 0)) / 100 : 0;
  const maximoPuntos = Math.max(0, Math.floor(Math.min(Number(detalle?.puntosDisponibles || 0) / 100, Math.round(pendienteCobro * 100) / 1000)) * 100);
  const puntosValidos = Number.isSafeInteger(Number(pago.puntos)) && Number(pago.puntos) >= 0 && Number(pago.puntos) % 100 === 0 && Number(pago.puntos) <= maximoPuntos;
  const puntosAplicados = puntosValidos ? Number(pago.puntos) : 0;
  return <main className="usuarios-page sprint2 pedidos-workspace">
    <button className="pedidos-back" onClick={onVolver}><ArrowLeft size={16} /> Volver al menú</button>
    <header className="modulo-header"><h2>Ventas</h2></header>
    <nav className="sprint-tabs" aria-label="Ventas"><button aria-pressed={vista === "venta"} onClick={()=>setVista("venta")}>Nueva venta</button><button aria-pressed={vista === "historial"} onClick={()=>setVista("historial")}>Historial</button>{puede("REPORTES_VER") && <button aria-pressed={vista === "reportes"} onClick={()=>setVista("reportes")}>Reportes</button>}</nav>
    <div className="comprobantes-toolbar" hidden={vista !== "historial"}><button disabled={ocupado} onClick={() => {
      setVista("historial"); setFiltros({ cliente: "", estado: "PAGADO", desde: "", hasta: "", pagina: 1 });
      setOcupado(true); setError(""); api.get("/pedidos", { ...config, params: { estado: "PAGADO" } }).then((r) => setPedidos(r.data)).catch(() => setError("No se pudieron consultar los comprobantes")).finally(() => setOcupado(false));
    }}>Consultar comprobantes de ventas pagadas</button><label><input type="checkbox" checked={imprimirAutomatico} onChange={(e) => setImprimirAutomatico(e.target.checked)} /> Abrir impresión al completar el cobro</label></div>
    {error && <p role="alert" className="error-message">{error}</p>}{mensaje && <p role="status" className="pedidos-success"><ShieldCheck size={19} />{mensaje}</p>}
    <div className="pedidos-create-layout" hidden={vista !== "venta"}>
    <section className="form-panel pedidos-create"><div className="pedidos-section-title"><span className="pedidos-section-icon"><Plus size={21} /></span><div><h3>Nueva venta</h3></div></div>
      <form onReset={()=>setForm({idCliente:"",descuento:0,clave:crypto.randomUUID(),detalles:[{idProducto:"",cantidad:1}]})} onSubmit={(e) => { e.preventDefault(); ejecutar(async () => {
        const idCliente = form.idCliente === 'nuevo' ? await registrarCliente() : form.idCliente && form.idCliente !== 'nit' ? Number(form.idCliente) : null;
        const receptor = form.idCliente === 'nit' ? { nombre: form.nombre, nit: form.nit } : null;
        const r = await api.post("/pedidos", { ...form, idCliente, receptor, descuento: Number(form.descuento), detalles: form.detalles.map((d) => ({ idProducto: Number(d.idProducto), cantidad: Number(d.cantidad) })) }, config);
        if ((r.data.estado || r.data.ESTADO) === "APROBADO" && puede("PAGOS_REGISTRAR")) {
          await api.post(`/pedidos/${r.data.ID_PEDIDO}/venta`, {}, config);
          const d = await api.get(`/pedidos/${r.data.ID_PEDIDO}`, config);
          setDetalle(d.data);
          setPago({ monto: dinero(d.data.pedido.TOTAL), metodo: "EFECTIVO", referencia: "", puntos: 0, recibido: "", clave: crypto.randomUUID() });
          setMensaje("Venta lista. Confirma el pago en la caja.");
        } else setMensaje(`Pedido #${r.data.ID_PEDIDO} registrado`); setVista("historial"); setForm({ idCliente:'',nombre:'',nit:'',descuento:0, clave: crypto.randomUUID(), detalles: [{ idProducto: "", cantidad: 1 }] });
      }); }}><fieldset disabled={ocupado}>
        <label>Cliente<select value={form.idCliente} onChange={(e) => setForm({ ...form, idCliente: e.target.value, nombre:'',nit:'' })}><option value="">Consumidor Final (CF) · Sin puntos</option><option value="nit">NIT solo para esta compra · Sin cuenta</option><option value="nuevo">Registrar cliente con puntos</option>{catalogo.clientes.map((c) => <option key={c.ID_CLIENTE} value={c.ID_CLIENTE}>{c.NOMBRES} {c.APELLIDOS} · {c.NIT}</option>)}</select></label>
        {['nit','nuevo'].includes(form.idCliente) && <div className="cliente-en-caja"><label>{form.idCliente === 'nit' ? 'Nombre o razón social' : 'Nombre del cliente'}<input required maxLength={form.idCliente === 'nit' ? 200 : 100} value={form.nombre || ''} onChange={e=>setForm({...form,nombre:e.target.value})}/></label><label>NIT de la compra<input required maxLength={20} value={form.nit || ''} onChange={e=>setForm({...form,nit:e.target.value})}/></label><p>{form.idCliente === 'nit' ? 'Se guarda en esta compra. No crea cuenta ni acumula puntos.' : 'Al continuar se registra el cliente y se conserva esta compra.'}</p></div>}
        {form.idCliente && !['nit','nuevo'].includes(form.idCliente) && <p className="receipt-note">Saldo del cliente: <strong>{catalogo.clientes.find(c => c.ID_CLIENTE === Number(form.idCliente))?.PUNTOS || 0} puntos</strong>. Puedes canjearlos al continuar al cobro, en bloques de 100 puntos por Q10.</p>}
        <p className="pedidos-hint">Solo clientes registrados acumulan puntos: Q100 = 10 pts. Canjea 100 pts por Q10.</p>
        {form.detalles.map((d, i) => <div className="compra-linea" key={i}>
          <label>Producto<select required value={d.idProducto} onChange={(e) => linea(i, "idProducto", e.target.value)}><option value="">Seleccionar producto</option>{catalogo.productos.map((p) => <option key={p.ID_PRODUCTO} value={p.ID_PRODUCTO}>{p.NOMBRE} · Q{dinero(p.PRECIO)} · Stock {p.STOCK}</option>)}</select></label>
          <label>Cantidad<input type="number" min="1" step="1" max="1000000" required value={d.cantidad} onChange={(e) => linea(i, "cantidad", e.target.value)} /></label>
          <button className="pedidos-remove" type="button" disabled={form.detalles.length === 1} onClick={() => setForm({ ...form, detalles: form.detalles.filter((_, j) => i !== j) })}>Quitar</button>
        </div>)}
        <button className="pedidos-add" type="button" disabled={form.detalles.length >= 100} onClick={() => setForm({ ...form, detalles: [...form.detalles, { idProducto: "", cantidad: 1 }] })}><Plus size={16} /> Agregar producto</button>
        {puede("DESCUENTOS_APLICAR") && <label>Descuento (%)<input type="number" min="0" max="50" step="0.01" required value={form.descuento} onChange={(e) => setForm({ ...form, descuento: e.target.value })} /></label>}
        <button className="btn-primary pedidos-submit"><ShoppingBag size={17} />{ocupado ? "Guardando…" : "Continuar al cobro"}</button>
      </fieldset></form>
    </section>
    <aside className="pedidos-receipt"><h3>Resumen</h3><div className="receipt-rule" /><dl><div><dt>Productos</dt><dd>{form.detalles.filter((d) => d.idProducto).length}</dd></div><div><dt>Productos (IVA incluido)</dt><dd>Q{dinero(subtotal)}</dd></div><div><dt>Descuento ({form.descuento || 0} %)</dt><dd>− Q{dinero(subtotal - total)}</dd></div><div><dt>Base sin IVA</dt><dd>Q{dinero(baseImponible)}</dd></div><div><dt>IVA incluido (12 %)</dt><dd>Q{dinero(ivaIncluido)}</dd></div></dl><div className="receipt-total"><span>Total estimado</span><strong>Q{dinero(total)}</strong></div><p className="receipt-policy">Descuentos mayores al 10 % o totales desde Q5,000 necesitan aprobación de otro usuario.</p></aside>
    </div>
    <section className="form-panel pedidos-list" hidden={vista !== "historial"}><div className="pedidos-section-title"><span className="pedidos-section-icon"><ClipboardList size={21} /></span><div><h3>Pedidos y seguimiento</h3><p>Encuentra cada pedido y continúa donde te quedaste.</p></div></div>
    <details className="pedidos-filters" open><summary><Search size={16} /> Búsqueda avanzada</summary><form onSubmit={(e) => { e.preventDefault(); ejecutar(cargar); }}>
      <label>Cliente o documento<input placeholder="Nombre o NIT…" value={filtros.cliente} onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value, pagina: 1 })} /></label>
      <label>Estado<select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value, pagina: 1 })}><option value="">Todos los estados</option>{Object.entries(estados).map(([s, nombre]) => <option key={s} value={s}>{nombre}</option>)}</select></label>
      {["desde", "hasta"].map((s) => <label key={s}>{s === "desde" ? "Desde" : "Hasta"}<input type="date" value={filtros[s]} onChange={(e) => setFiltros({ ...filtros, [s]: e.target.value, pagina: 1 })} /></label>)}
      <label>Página (50 resultados)<input type="number" min="1" max="100000" value={filtros.pagina} onChange={(e) => setFiltros({ ...filtros, pagina: e.target.value })} /></label><button disabled={ocupado}>Buscar</button>
    </form></details>
    <ExportarCsv filas={pedidos} nombre="historial-pedidos" columnas={['ID_PEDIDO', 'FECHA', 'NOMBRES', 'APELLIDOS', 'ESTADO', 'TOTAL', 'PAGADO']} disabled={ocupado} alcance="pedidos de la página consultada (máximo 50)" />
      <div className="tabla-scroll"><table className="usuarios-tabla"><thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Pagado</th><th>Forma de pago</th><th>Acciones</th></tr></thead><tbody>
      {pedidos.map((p) => <tr key={p.ID_PEDIDO}><td><strong className="pedidos-number">#{p.ID_PEDIDO}</strong></td><td>{p.NOMBRES} {p.APELLIDOS}</td><td><span className={`pedidos-status status-${p.ESTADO}`}>{estados[p.ESTADO] || p.ESTADO}</span></td><td className="pedidos-money">Q{dinero(p.TOTAL)}</td><td className="pedidos-money">Q{dinero(p.PAGADO)}</td><td><div className="pago-desglose">{["EFECTIVO", "TARJETA", "TRANSFERENCIA", "PUNTOS"].filter((m) => Number(p[m]) > 0).map((m) => <span key={m}>{({ EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", PUNTOS: "Puntos" })[m]}: <strong>Q{dinero(p[m])}</strong></span>)}{!Number(p.PAGADO) && <span>Sin pagos</span>}</div></td><td><div className="pedidos-actions">
        <button disabled={ocupado} onClick={() => abrir(p)}>Ver detalle</button>
        {p.ESTADO === "PAGADO" && <button disabled={ocupado} onClick={() => ejecutar(() => verComprobante(p.ID_PEDIDO))}>Ver comprobante</button>}
        {p.ESTADO === "APROBADO" && <button disabled={ocupado} onClick={() => accion(p.ID_PEDIDO, "venta")}>Generar venta</button>}
        {["APROBADO", "PENDIENTE_APROBACION"].includes(p.ESTADO) && <button disabled={ocupado} onClick={() => accion(p.ID_PEDIDO, "cancelar")}>Cancelar pedido</button>}
      </div></td></tr>)}
      {!pedidos.length && <tr><td colSpan="7"><div className="pedidos-empty"><ClipboardList size={34} strokeWidth={1.3} /><strong>Todo listo para tu próximo pedido</strong><span>Sin pedidos para estos filtros. Crea uno nuevo o ajusta tu búsqueda.</span></div></td></tr>}
    </tbody></table></div></section>
    {detalle && <section className="form-panel pedidos-detail caja-panel" role="dialog" aria-modal="true" aria-label="Caja de cobro"><div className="pedidos-section-title"><h3>Pedido #{detalle.pedido.ID_PEDIDO}</h3><span className={`pedidos-status status-${detalle.pedido.ESTADO}`}>{estados[detalle.pedido.ESTADO]}</span><button className="pedidos-close" onClick={() => setDetalle(null)}>Cerrar detalle</button></div>
      <p>Subtotal Q{dinero(detalle.pedido.SUBTOTAL)} · Descuento {detalle.pedido.DESCUENTO}% · Total Q{dinero(detalle.pedido.TOTAL)}</p>
      {detalle.pedido.IVA != null && <div className="caja-impuestos"><span>Base sin IVA: <strong>Q{dinero(detalle.pedido.BASE_IMPONIBLE)}</strong></span><span>IVA incluido ({detalle.pedido.IVA_TASA}%): <strong>Q{dinero(detalle.pedido.IVA)}</strong></span><span>Total con IVA: <strong>Q{dinero(detalle.pedido.TOTAL)}</strong></span></div>}
      <details open={detalle.pedido.ESTADO !== "VENDIDO"}><summary>Ver productos, pagos e historial</summary><Tabla filas={detalle.detalles} /><h4>Aprobaciones</h4><Tabla filas={detalle.aprobaciones} /><h4>Pagos</h4><Tabla filas={detalle.pagos} />{detalle.movimientosPuntos?.length > 0 && <details><summary>Historial de puntos del cliente</summary><Tabla filas={detalle.movimientosPuntos} /></details>}</details>
      {detalle.pedido.ESTADO === "PENDIENTE_APROBACION" && puede("PEDIDOS_APROBAR") && <div><label>Motivo<input maxLength="500" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>{["APROBADO", "RECHAZADO"].map((decision) => <button key={decision} disabled={ocupado || !motivo.trim()} onClick={() => accion(detalle.pedido.ID_PEDIDO, "decision", { decision, motivo })}>{decision === "APROBADO" ? "Aprobar" : "Rechazar"}</button>)}</div>}
      {detalle.pedido.ESTADO === "VENDIDO" && puede("PAGOS_REGISTRAR") && <form onReset={()=>setPago({...pago,puntos:0,monto:dinero(pendienteCobro),recibido:"",referencia:""})} onSubmit={(e) => { e.preventDefault(); if (!puntosValidos) return; accion(detalle.pedido.ID_PEDIDO, "pagos", { ...pago, monto: Number(pago.monto), puntos: Number(pago.puntos), recibido: pago.metodo === "EFECTIVO" && pago.recibido !== "" ? Number(pago.recibido) : null }); }}><fieldset disabled={ocupado}>
        <h3>Confirmar cobro</h3>{error && <p role="alert" className="error-message">{error}</p>}
        <p>Por cobrar: <strong>Q{dinero(detalle.pedido.TOTAL - detalle.pagos.reduce((n, p) => n + Number(p.MONTO), 0))}</strong></p>
        {detalle.pedido.ID_CLIENTE ? <label>Usar puntos · disponibles: {detalle.puntosDisponibles || 0}
          <input type="number" min="0" step="100" max={maximoPuntos} disabled={maximoPuntos === 0} aria-describedby="ayuda-canje" aria-invalid={!puntosValidos} value={pago.puntos} onChange={(e) => {
            const puntos = e.target.value;
            const valor = Number(puntos);
            const valido = Number.isSafeInteger(valor) && valor >= 0 && valor % 100 === 0 && valor <= maximoPuntos;
            setPago({ ...pago, puntos, monto: dinero(pendienteCobro - (valido ? valor / 10 : 0)) });
          }} />
          <small id="ayuda-canje">{maximoPuntos === 0
            ? Number(detalle.puntosDisponibles || 0) < 100
              ? `Necesitas al menos 100 puntos para canjear Q10. Te faltan ${100 - Number(detalle.puntosDisponibles || 0)} puntos. Puedes cobrar sin canjear.`
              : 'El saldo por cobrar es menor a Q10. No se pueden canjear puntos en este cobro.'
            : `Opcional: canjea múltiplos de 100 puntos (Q10), hasta ${maximoPuntos} puntos. Cubierto: Q${dinero(puntosAplicados / 10)}`}</small>
          {!puntosValidos && <small role="alert">Ingresa 0 o un múltiplo de 100, hasta {maximoPuntos}. No se ha aplicado el canje.</small>}
        </label> : <p>Consumidor Final · Esta venta no acumula ni canjea puntos.</p>}
        <label>Monto a cobrar (Q)<input type="number" required min={puntosAplicados > 0 ? "0" : "0.01"} step="0.01" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} /></label>
        <label>Método<select value={pago.metodo} onChange={(e) => setPago({ ...pago, metodo: e.target.value, recibido: "", referencia: "" })}>{["EFECTIVO", "TARJETA", "TRANSFERENCIA"].map((m) => <option key={m}>{m}</option>)}</select></label>
        {pago.metodo === "EFECTIVO" && Number(pago.monto) > 0 ? <><label>Efectivo recibido (Q)<input type="number" required min={pago.monto} step="0.01" value={pago.recibido} onChange={(e) => setPago({ ...pago, recibido: e.target.value })} /></label><p className="caja-cambio">Cambio: Q{dinero(Math.max(0, Number(pago.recibido) - Number(pago.monto)))}</p></> : Number(pago.monto) > 0 && <><p>Confirma que recibiste el pago en tu terminal o cuenta bancaria.</p><label>Referencia<input required maxLength="100" value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} /></label></>}
        <button disabled={!puntosValidos} className="btn-primary pedidos-submit">{ocupado ? "Registrando…" : "Confirmar cobro"}</button>
      </fieldset></form>}
    </section>}
    {puede("REPORTES_VER") && <section className="form-panel pedidos-reports" hidden={vista !== "reportes"}><div className="pedidos-section-title"><span className="pedidos-section-icon"><BarChart3 size={21} /></span><div><h3>Reportes de pedidos pagados</h3><p></p></div></div><div className="reporte-filtros">{['desde','hasta'].map(campo=><label key={campo}>{campo==='desde'?'Desde reporte':'Hasta reporte'}<input type="date" value={filtros[campo]} onChange={e=>{setFiltros({...filtros,[campo]:e.target.value});setReporte(null);}}/></label>)}<label>Cliente del reporte<input value={filtros.cliente} onChange={e=>{setFiltros({...filtros,cliente:e.target.value});setReporte(null);}}/></label></div><p>Fecha de creación del pedido.</p>{["ventas", "productos"].map((tipo) => <button className={reporte?.tipo === tipo ? "report-active" : ""} key={tipo} disabled={ocupado} onClick={() => ejecutar(async () => { const r = await api.get(`/reportes/sprint3/${tipo}`, { ...config, params: { ...filtros, estado: "" } }); setReporte({ tipo, filas: r.data }); })}>{tipo === "ventas" ? "Ventas por día" : "Productos vendidos"}</button>)}
      {reporte && <><h4>{reporte.tipo === "ventas" ? "Ventas por día de pedido" : "Productos vendidos (importe bruto antes de descuentos)"}</h4><ExportarCsv filas={reporte.filas} nombre={`reporte-${reporte.tipo}-${filtros.desde || "inicio"}-${filtros.hasta || "hoy"}`} disabled={ocupado} /><Tabla filas={reporte.filas} /></>}
    </section>}
    {puede("BITACORA_VER") && <section className="form-panel" hidden={vista !== "reportes"}><h3>Auditoría</h3><button disabled={ocupado} onClick={() => ejecutar(async () => { const r = await api.get("/auditoria/sprint3", config); setAuditoria(r.data); })}>Consultar últimas 200 acciones</button>{auditoria && <><ExportarCsv filas={auditoria} nombre="auditoria-pedidos" alcance="acciones consultadas (máximo 200)" disabled={ocupado} /><Tabla filas={auditoria} /></>}</section>}
    {comprobante && <ComprobanteVenta {...comprobante} onCerrar={() => setComprobante(null)} />}
  </main>;
}
function Tabla({ filas }) {
  if (!filas.length) return <p>Sin registros.</p>;
  const etiquetas = { BASE_IMPONIBLE: "Base sin IVA (Q)", IVA: "IVA incluido (Q)", PUNTOS: "Puntos", SALDO: "Saldo de puntos", INGRESOS: "Dinero recibido (Q)", CANJE_PUNTOS: "Pagado con puntos (Q)", RECIBIDO: "Efectivo recibido (Q)", NOMBRE: "Producto", CODIGO: "Código", CANTIDAD: "Cantidad", PRECIO: "Precio (Q)", DECISION: "Decisión", MOTIVO: "Motivo", FECHA: "Fecha", FECHA_HORA: "Fecha", DIA: "Día", MONTO: "Monto (Q)", METODO: "Método", REFERENCIA: "Referencia", VENTAS: "Ventas", SUBTOTAL: "Subtotal (Q)", DESCUENTOS: "Descuentos (Q)", TOTAL: "Total (Q)", UNIDADES: "Unidades", IMPORTE_BRUTO: "Importe bruto (Q)", ACCION: "Acción", DETALLE: "Detalle", ID_USUARIO: "Usuario", ID_REGISTRO_AFECTADO: "Pedido" };
  const campos = Object.keys(filas[0]).filter((c) => etiquetas[c]);
  const valor = (campo, v) => {
    if (v == null) return "—";
    if (["FECHA", "FECHA_HORA", "DIA"].includes(campo)) return new Date(v).toLocaleString("es-GT", { timeZone: "America/Guatemala" });
    return String(v);
  };
  return <div className="tabla-scroll"><table className="usuarios-tabla"><thead><tr>{campos.map((c) => <th key={c}>{etiquetas[c]}</th>)}</tr></thead><tbody>{filas.map((f, i) => <tr key={i}>{campos.map((c) => <td key={c}>{valor(c, f[c])}</td>)}</tr>)}</tbody></table></div>;
}
