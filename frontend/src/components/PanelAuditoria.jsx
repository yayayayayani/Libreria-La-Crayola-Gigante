import { useEffect, useState } from "react";
import { Info, History, Search, UserRound } from "lucide-react";
import api from "../services/api";
import { modulosAuditoria, accionesAuditoria, nombreAccion, nombreModulo, detalleAuditoria } from "../services/auditoriaVista";
const vacios = { tabla: "", accion: "", buscar: "", usuario: "", registro: "" };
export default function PanelAuditoria({ token, periodo, version }) {
  const [filtros,setFiltros] = useState(vacios), [texto,setTexto] = useState(vacios), [pagina,setPagina] = useState(1);
  const [respuesta,setRespuesta] = useState(null), [fallo,setFallo] = useState(null), [reintento,setReintento] = useState(0);
  const clave = JSON.stringify({ ...periodo, ...filtros, pagina, version, reintento });
  const datos = respuesta?.clave === clave ? respuesta.datos : null, error = fallo?.clave === clave ? fallo.mensaje : "";
  useEffect(() => {
    const controlador = new AbortController(), params = JSON.parse(clave);
    delete params.version; delete params.reintento;
    api.get("/auditoria", { headers: { Authorization: `Bearer ${token}` }, params, signal: controlador.signal })
      .then(r => { if (!controlador.signal.aborted) setRespuesta({ clave, datos:r.data }); })
      .catch(e => { if (!controlador.signal.aborted) setFallo({ clave, mensaje:e.response?.data?.mensaje || "No se pudo consultar la auditoría. Reintenta la consulta." }); });
    return () => controlador.abort();
  },[token,clave]);
  const limpiar = () => { setFiltros(vacios); setTexto(vacios); setPagina(1); };
  const acciones = datos?.acciones || respuesta?.datos?.acciones || Object.keys(accionesAuditoria);
  const descripcion = filtros.tabla ? modulosAuditoria[filtros.tabla]?.[1] : "Aquí se reúnen los cambios registrados en los módulos: quién realizó la acción, cuándo ocurrió y qué registro fue afectado. Selecciona un módulo para conocer qué actividades puedes encontrar.";
  const fecha = v => new Date(v).toLocaleString("es-GT", { timeZone:"America/Guatemala", dateStyle:"medium", timeStyle:"short" });
  return <div className="operativo-auditoria">
    <span className="panel-kicker">HISTORIAL DE ACTIVIDAD</span><h3>Auditoría de todos los módulos</h3><p>Revisa los cambios del sistema. Cada tarjeta corresponde a una acción; la persona que la realizó y el registro afectado se muestran por separado.</p>
    <div className="filtros-campos auditoria-selectores">
      <label>Módulo auditado<select value={filtros.tabla} onChange={e => { setFiltros(f => ({...f, tabla:e.target.value, accion:""})); setPagina(1); }}><option value="">Todos los módulos</option>{Object.entries(modulosAuditoria).map(([v,[n]]) => <option key={v} value={v}>{n}</option>)}</select></label>
      <label>Acción registrada<select value={filtros.accion} onChange={e => { setFiltros(f => ({...f, accion:e.target.value})); setPagina(1); }}><option value="">Todas las acciones</option>{[...new Set([...acciones, ...(filtros.accion ? [filtros.accion] : [])])].map(a => <option value={a} key={a}>{nombreAccion(a)}</option>)}</select></label>
    </div>
    <aside className="auditoria-explicacion"><Info size={20} aria-hidden="true" /><div><h4>{filtros.tabla ? `¿Qué muestra ${nombreModulo(filtros.tabla)}?` : "¿Qué muestra esta sección?"}</h4><p>{descripcion}</p><p className="nota-historial">Solo aparecen acciones que fueron registradas por la auditoría. La ausencia de eventos no significa que el módulo no tenga datos; los cambios antiguos sin registro no se reconstruyen automáticamente.</p></div></aside>
    <form className="auditoria-busqueda" onSubmit={e => { e.preventDefault(); setFiltros(f => ({...f, buscar:texto.buscar.trim(), usuario:texto.usuario.trim(), registro:texto.registro})); setPagina(1); }}>
      <div className="filtros-campos"><label><span><Search size={14} aria-hidden="true" /> Buscar en el detalle</span><input maxLength="150" type="search" value={texto.buscar} onChange={e => setTexto(t => ({...t,buscar:e.target.value}))} placeholder="Nombre afectado, concepto o referencia" /></label><label>Realizado por<input type="search" maxLength="100" value={texto.usuario} onChange={e => setTexto(t => ({...t,usuario:e.target.value}))} placeholder="Nombre o cuenta de quien hizo el cambio" /></label><label>Número de registro<input type="number" min="1" step="1" value={texto.registro} onChange={e => setTexto(t => ({...t,registro:e.target.value}))} placeholder="Por ejemplo: 295" /></label></div>
      <div className="operativo-acciones"><button className="operativo-primario">Aplicar filtros de auditoría</button><button type="button" onClick={limpiar}>Limpiar filtros de auditoría</button></div>
    </form>
    {(filtros.accion || filtros.buscar || filtros.usuario || filtros.registro) && <p className="auditoria-filtros-aplicados">Filtros aplicados: {[filtros.accion && nombreAccion(filtros.accion), filtros.buscar && `Detalle: ${filtros.buscar}`, filtros.usuario && `Realizado por: ${filtros.usuario}`, filtros.registro && `Registro n.º ${filtros.registro}`].filter(Boolean).join(" · ")}</p>}
    {error && <div className="consulta-vacia"><p role="alert">{error}</p><button onClick={() => { setFallo(null); setReintento(v => v+1); }}>Reintentar auditoría</button></div>}
    {!datos && !error && <p role="status">Consultando auditoría…</p>}
    {datos && !error && <>
      {!datos.registros.length ? <div className="consulta-vacia" role="status"><History size={32} aria-hidden="true" /><h4>No hay eventos de {filtros.tabla ? nombreModulo(filtros.tabla).toLowerCase() : "auditoría"} con estos filtros</h4><p>Revisa el período de fechas en la parte superior o limpia los filtros de búsqueda. Cuando se registre alguna de las acciones descritas arriba, aparecerá aquí con su responsable y fecha.</p><button type="button" onClick={limpiar}>Ver todos los módulos sin filtros</button></div> : <>
        <div className="auditoria-conteo"><strong>{datos.total} {datos.total === 1 ? "evento encontrado" : "eventos encontrados"}</strong><span>Página {pagina} de {Math.max(1,Math.ceil(datos.total/50))} · Más recientes primero</span></div>
        <div className="auditoria-eventos">{datos.registros.map(b => <article className="auditoria-evento" key={b.ID_BITACORA} aria-label={`${nombreAccion(b.ACCION)} · evento ${b.ID_BITACORA}`}>
          <div className="evento-cabecera"><div><span className="evento-modulo">{nombreModulo(b.TABLA_AFECTADA)}</span><h4>{nombreAccion(b.ACCION)}</h4></div><time dateTime={b.FECHA_HORA}>{fecha(b.FECHA_HORA)}</time></div>
          <div className="evento-identidad"><span><UserRound size={17} aria-hidden="true" /><span><small>Realizado por</small><b>{b.ACTOR_NOMBRE || b.ACTOR || (b.ID_USUARIO ? `Usuario n.º ${b.ID_USUARIO} (nombre no disponible)` : "Sistema")}</b>{b.ACTOR_NOMBRE && b.ACTOR && <small>Cuenta: {b.ACTOR}</small>}</span></span><span><small>Registro afectado</small><b>{nombreModulo(b.TABLA_AFECTADA)} · n.º {b.ID_REGISTRO_AFECTADO ?? "no disponible"}</b></span></div>
          <dl className="evento-detalle">{detalleAuditoria(b).map((d,i) => <div key={`${d.nombre}-${i}`}><dt>{d.nombre}</dt><dd>{d.valor}</dd></div>)}</dl>
        </article>)}</div>
        <div className="auditoria-paginacion"><button disabled={pagina===1} onClick={() => setPagina(p => p-1)}>Página anterior</button><span>Página {pagina}</span><button disabled={pagina*50>=datos.total} onClick={() => setPagina(p => p+1)}>Más eventos</button></div>
      </>}
    </>}
  </div>;
}
