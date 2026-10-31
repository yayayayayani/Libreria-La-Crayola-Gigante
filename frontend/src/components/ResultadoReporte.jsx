import { useState } from "react";
import { Search, SlidersHorizontal, Info, FileSearch } from "lucide-react";
import { descargarCsv } from "../services/descargas";
import { reportesVista, filtrosReporteIniciales, filtrarReporte, valorReporte, quetzales, fechaReporte, exportarFilasReporte } from "../services/reportesVista";

export default function ResultadoReporte({ reporte }) {
  const [filtros, setFiltros] = useState(filtrosReporteIniciales);
  const cfg = reportesVista[reporte.tipo], filas = filtrarReporte(reporte.filas, reporte.tipo, filtros);
  const cambiar = (k,v) => setFiltros(f => ({ ...f, [k]:v }));
  const grupos = cfg.grupo ? [...new Set(reporte.filas.map(r => r[cfg.grupo]).filter(Boolean))].sort((a,b) => a.localeCompare(b,"es")) : [];
  const invalido = filtros.minimo !== "" && filtros.maximo !== "" && Number(filtros.minimo) > Number(filtros.maximo);
  const suma = campo => filas.reduce((t,r) => t + Math.round(Number(r[campo] || 0) * 100), 0) / 100;
  const usados = [filtros.buscar && `Búsqueda: ${filtros.buscar}`, filtros.grupo && `${cfg.grupoNombre}: ${filtros.grupo}`, filtros.estado && `Estado: ${{pendiente:"Con saldo pendiente",pagada:"Pagada",A:"Activo",I:"Inactivo",reabastecer:"Por reabastecer"}[filtros.estado]}`, filtros.minimo !== "" && `${cfg.montoNombre} desde ${quetzales(filtros.minimo)}`, filtros.maximo !== "" && `${cfg.montoNombre} hasta ${quetzales(filtros.maximo)}`, filtros.cantidad !== "" && `${cfg.cantidadNombre} desde ${filtros.cantidad}`].filter(Boolean);
  return <div className="reporte-resultado">
    <div className="reporte-filtros">
      <div className="reporte-filtros-titulo"><SlidersHorizontal size={19} aria-hidden="true" /><div><h4>Refina tu consulta</h4><p>Los filtros se aplican a los {reporte.filas.length} registros consultados. La descarga y la impresión respetan lo que ves.</p></div></div>
      <div className="filtros-campos">
        <label><span><Search size={14} aria-hidden="true" /> Buscar en el reporte</span><input type="search" value={filtros.buscar} onChange={e => cambiar("buscar",e.target.value)} placeholder={reporte.tipo === "compras" ? "Proveedor, factura o número de compra" : reporte.tipo === "ventas" ? "Fecha o valor" : "Nombre o código del producto"} /></label>
        {cfg.grupo && <label>{cfg.grupoNombre}<select value={filtros.grupo} onChange={e => cambiar("grupo",e.target.value)}><option value="">{cfg.grupo === "PROVEEDOR" ? "Todos los proveedores" : "Todas las categorías"}</option>{grupos.map(g => <option key={g}>{g}</option>)}</select></label>}
        {["compras","inventario"].includes(reporte.tipo) && <label>{reporte.tipo === "compras" ? "Estado de pago" : "Estado del inventario"}<select value={filtros.estado} onChange={e => cambiar("estado",e.target.value)}><option value="">Todos</option>{(reporte.tipo === "compras" ? [["pendiente","Con saldo pendiente"],["pagada","Pagada"]] : [["A","Activos"],["I","Inactivos"],["reabastecer","Por reabastecer"]]).map(([v,n]) => <option value={v} key={v}>{n}</option>)}</select></label>}
        <label>{cfg.montoNombre} mínimo (Q)<input type="number" min="0" step="0.01" value={filtros.minimo} onChange={e => cambiar("minimo",e.target.value)} placeholder="Sin mínimo" /></label>
        <label>{cfg.montoNombre} máximo (Q)<input type="number" min="0" step="0.01" value={filtros.maximo} onChange={e => cambiar("maximo",e.target.value)} placeholder="Sin máximo" /></label>
        {cfg.cantidad && <label>{cfg.cantidadNombre} mínimas<input type="number" min="0" step="1" value={filtros.cantidad} onChange={e => cambiar("cantidad",e.target.value)} placeholder="Sin mínimo" /></label>}
        <label>Ordenar reporte<select value={filtros.orden} onChange={e => cambiar("orden",e.target.value)}><option value="original">Orden original</option><option value="monto-desc">Mayor {cfg.montoNombre.toLowerCase()}</option><option value="monto-asc">Menor {cfg.montoNombre.toLowerCase()}</option>{cfg.cantidad && <option value="cantidad-desc">Mayor cantidad</option>}{reporte.tipo !== "ventas" && <option value="nombre">Nombre: A a Z</option>}</select></label>
      </div>
      <button type="button" onClick={() => setFiltros(filtrosReporteIniciales)}>Limpiar filtros del reporte</button>
      {invalido && <p role="alert" className="filtro-error">El monto mínimo no puede superar al máximo.</p>}
    </div>
    <div className="operativo-impresion">
      <h3>{cfg.titulo}</h3><p>{reporte.tipo === "inventario" ? "Existencias actuales al consultar" : `${fechaReporte(reporte.desde)} al ${fechaReporte(reporte.hasta)}`} · {filas.length} de {reporte.filas.length} registros</p>
      <div className="reporte-explicacion"><Info size={19} aria-hidden="true" /><div><strong>Cómo leer este reporte</strong><p>{cfg.ayuda}</p></div></div>
      {!!usados.length && <p className="reporte-filtros-aplicados"><b>Filtros aplicados:</b> {usados.join(" · ")}</p>}
      <div className="reporte-resumen"><span><small>Registros mostrados</small><b>{filas.length}</b></span>{reporte.tipo !== "inventario" && <span><small>{cfg.montoNombre} de los resultados</small><b>{quetzales(suma(cfg.monto))}</b></span>}{reporte.tipo === "compras" && <span><small>Pendiente de los resultados</small><b>{quetzales(suma("PENDIENTE"))}</b></span>}{cfg.cantidad && <span><small>{cfg.cantidadNombre} en los resultados</small><b>{suma(cfg.cantidad).toLocaleString("es-GT")}</b></span>}</div>
      <div className="operativo-acciones"><button disabled={!filas.length || invalido} onClick={() => descargarCsv(exportarFilasReporte(filas,reporte.tipo), `${reporte.tipo}-${reporte.desde}-${reporte.hasta}.csv`)}>Descargar reporte CSV</button><button disabled={!filas.length || invalido} onClick={() => window.print()}>Imprimir / guardar PDF</button></div>
      {!filas.length ? <div className="consulta-vacia" role="status"><FileSearch size={30} aria-hidden="true" /><h4>{reporte.filas.length ? "Ningún registro coincide con estos filtros" : "No hay registros para esta consulta"}</h4><p>{reporte.filas.length ? "Limpia los filtros o prueba otra búsqueda para recuperar los resultados de la consulta." : reporte.tipo === "inventario" ? "Aquí aparecerán los productos registrados. Si acabas de crear uno, vuelve a consultar el reporte." : "Prueba otro período y pulsa Consultar reporte. Solo aparecen operaciones registradas que cumplen las condiciones de este reporte."}</p></div>
        : <div className="tabla-scroll"><table className="reporte-tabla"><thead><tr>{cfg.columnas.map(c => <th key={c.clave} className={["moneda","numero"].includes(c.tipo) ? "celda-numero" : ""}>{c.titulo}</th>)}</tr></thead><tbody>{filas.map((r,i) => <tr key={i}>{cfg.columnas.map(c => <td key={c.clave} className={["moneda","numero"].includes(c.tipo) ? "celda-numero" : ""}>{valorReporte(r[c.clave],c.tipo)}</td>)}</tr>)}</tbody></table></div>}
    </div>
  </div>;
}
