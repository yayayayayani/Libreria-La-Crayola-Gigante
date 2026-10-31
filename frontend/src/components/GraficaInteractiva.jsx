import { usePreferencia } from "../hooks/usePreferencia";
import { useEffect, useId, useRef, useState } from "react";
import { BarChart3, ChartLine, ChartArea, ChartColumn, ChartPie, Table2, Info } from "lucide-react";
import { dinero, serieDiaria } from "../services/graficas";

const estilos = { lineas: ["Líneas", ChartLine], area: ["Área", ChartArea], columnas: ["Columnas", ChartColumn], barras: ["Barras", BarChart3], dona: ["Dona", ChartPie], tabla: ["Tabla", Table2] };
const colores = ["#227664", "#477ea1", "#a37028", "#8c659b", "#b25d50", "#447b85", "#6f7732", "#855f48", "#5867a4", "#9d547c"];
export default function GraficaInteractiva({ tipo, filas, periodo }) {
  const contenedor = useRef(null);
  const [anchoDisponible, setAnchoDisponible] = useState(480);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setAnchoDisponible(Math.floor(entries[0].contentRect.width)));
    if (contenedor.current) observer.observe(contenedor.current);
    return () => observer.disconnect();
  }, []);
  const ventas = tipo === "ventas", titulo = ventas ? "Ventas por día" : "Productos más vendidos";
  const opciones = ventas ? ["lineas", "area", "columnas", "tabla"] : ["barras", "columnas", "dona", "tabla"];
  const [estilo, setEstilo] = usePreferencia(`grafica-${tipo}`, ventas ? "lineas" : "barras", opciones);
  const [metrica, setMetrica] = usePreferencia("metrica-ventas", "TOTAL", ["TOTAL", "VENTAS"]);
  const [seleccion, setSeleccion] = useState(null), ayudaId = useId(), gradiente = useId();
  const monetario = ventas && metrica === "TOTAL";
  const formato = n => monetario ? dinero(n) : Number(n).toLocaleString("es-GT");
  const datos = ventas ? serieDiaria(filas, periodo.desde, periodo.hasta, metrica) : filas.map(f => ({ id: f.CODIGO, nombre: f.NOMBRE || f.CODIGO, detalle: `Código ${f.CODIGO}`, valor: Number(f.UNIDADES) }));
  const total = datos.reduce((s, d) => s + d.valor, 0), max = Math.max(1, ...datos.map(d => d.valor));
  const elegido = datos.find(d => d.id === seleccion), mayor = datos.reduce((m, d) => !m || d.valor > m.valor ? d : m, null);
  const ancho = Math.max(240, anchoDisponible, datos.length > 60 ? datos.length * 12 : 0), alto = 280, izq = 76, der = 22, arriba = 24, base = 226;
  const x = i => izq + (i + .5) / Math.max(1, datos.length) * (ancho - izq - der);
  const y = v => base - v / max * (base - arriba);
  const puntos = datos.map((d, i) => `${x(i)},${y(d.valor)}`).join(" ");
  const describir = d => `${d.nombre}, ${d.detalle}: ${formato(d.valor)}${ventas ? (monetario ? "" : " ventas") : " unidades"}`;
  const elegir = d => setSeleccion(d.id);
  const activar = (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(d); } };
  const interaccion = d => ({ tabIndex: 0, role: "button", "aria-label": describir(d), "aria-pressed": seleccion === d.id, onPointerEnter: () => elegir(d), onFocus: () => elegir(d), onClick: () => elegir(d), onKeyDown: e => activar(e, d) });
  const instrucciones = {
    lineas: "Lee las fechas de izquierda a derecha. Cada punto representa un día: cuanto más alto, mayor es el valor. La línea permite ver subidas y bajadas; los días sin ventas aparecen en cero.",
    area: "La altura del área muestra el valor de cada día, no un acumulado. Lee las fechas de izquierda a derecha: un pico indica más actividad y una zona baja, menos.",
    columnas: ventas ? "Cada columna es un día. Su altura indica el importe o la cantidad de ventas, según la medida elegida. La escala comienza en cero para comparar sin exagerar diferencias." : "Cada columna representa un producto. Una columna más alta significa más unidades vendidas. Tócala para consultar el nombre completo y su cantidad.",
    barras: "Cada barra representa un producto, ordenado de mayor a menor venta. Una barra más larga significa más unidades vendidas. El nombre y el código identifican el producto.",
    dona: "Cada segmento representa la proporción de unidades de un producto dentro de los productos mostrados (hasta diez). Los porcentajes no representan todas las ventas de la librería. Toca un segmento o su nombre para ver el detalle.",
    tabla: ventas ? "Cada fila corresponde a un día del período. La segunda columna contiene su valor exacto según la medida seleccionada. Los días sin ventas muestran cero." : "Cada fila muestra el nombre, código y unidades vendidas de un producto. El orden va de mayor a menor cantidad.",
  };
  return <figure ref={contenedor} className="grafica-card" aria-label={titulo} aria-describedby={ayudaId}>
    <figcaption><span className="panel-kicker">{ventas ? "EVOLUCIÓN DEL PERÍODO" : "LOS FAVORITOS DE TUS CLIENTES"}</span><h3>{titulo}</h3><p>{ventas ? "Explora cómo cambian tus ventas a lo largo del tiempo." : "Compara hasta diez productos por unidades vendidas."}</p></figcaption>
    <div className="grafica-controles">
      <div className="grafica-estilos" role="group" aria-label={`Estilo de ${titulo.toLowerCase()}`}>{opciones.map(v => { const [nombre, Icono] = estilos[v]; return <button key={v} type="button" aria-pressed={estilo === v} onClick={() => { setEstilo(v); setSeleccion(null); }}><Icono size={16} aria-hidden="true" />{nombre}</button>; })}</div>
      {ventas && <label className="grafica-medida">Medida<select value={metrica} onChange={e => { setMetrica(e.target.value); setSeleccion(null); }}><option value="TOTAL">Importe vendido (Q)</option><option value="VENTAS">Número de ventas</option></select></label>}
    </div>
    {!datos.length ? <div className="grafica-vacia"><BarChart3 size={36} aria-hidden="true" /><strong>Aún no hay ventas pagadas en este período</strong><p>Prueba con otro rango de fechas. Los pedidos pendientes no se incluyen.</p></div> : <>
      <div className="grafica-destacado"><span>{ventas ? "Total del período" : "Unidades de estos productos"}</span><strong>{formato(total)}{!ventas && <small> unidades</small>}</strong><span>{ventas ? (monetario ? "Importe de pedidos pagados" : "Pedidos pagados") : "Hasta 10 productos · ordenados por unidades"}</span></div>
      {estilo === "tabla" ? <div className="grafica-tabla"><table><caption>{titulo} · valores exactos</caption><thead><tr><th>{ventas ? "Fecha" : "Producto"}</th>{!ventas && <th>Código</th>}<th>{ventas ? (monetario ? "Importe (Q)" : "Ventas") : "Unidades"}</th></tr></thead><tbody>{datos.map(d => <tr key={d.id}><td>{ventas ? d.id : d.nombre}</td>{!ventas && <td>{d.id}</td>}<td>{formato(d.valor)}</td></tr>)}</tbody></table></div>
      : estilo === "barras" ? <div className="grafica-barras">{datos.map((d, i) => <button key={d.id} className="grafica-fila" type="button" {...interaccion(d)}><span><b>{String(i + 1).padStart(2, "0")}</b><span>{d.nombre}<small>{d.detalle}</small></span></span><span className="grafica-pista"><i style={{ width: `${d.valor / max * 100}%` }} /></span><strong>{formato(d.valor)}</strong></button>)}</div>
      : estilo === "dona" ? <div className="grafica-dona"><svg viewBox="0 0 240 240" aria-label="Distribución de unidades entre los productos mostrados"><circle cx="120" cy="120" r="82" fill="none" stroke="#edf2ef" strokeWidth="36" />{datos.map((d, i) => { const fraccion = total ? d.valor / total : 0, inicio = total ? datos.slice(0, i).reduce((sum, p) => sum + p.valor, 0) / total : 0; return <circle key={d.id} cx="120" cy="120" r="82" fill="none" stroke={colores[i % colores.length]} strokeWidth={seleccion === d.id ? 43 : 36} pathLength="100" strokeDasharray={`${fraccion * 100} ${100 - fraccion * 100}`} strokeDashoffset={-inicio * 100} transform="rotate(-90 120 120)" className="grafica-marca" {...interaccion(d)}><title>{describir(d)} · {(fraccion * 100).toFixed(1)}%</title></circle>; })}<text x="120" y="116" textAnchor="middle" className="dona-total">{formato(total)}</text><text x="120" y="139" textAnchor="middle" className="dona-label">unidades del top 10</text></svg><ul>{datos.map((d, i) => <li key={d.id}><button type="button" {...interaccion(d)}><i style={{ background: colores[i % colores.length] }} /><span>{d.nombre}</span><strong>{total ? (d.valor / total * 100).toFixed(1) : 0}%</strong></button></li>)}</ul></div>
      : <div className="grafica-lienzo" tabIndex={0} role="group" aria-label={`${titulo}: área desplazable`}><svg viewBox={`0 0 ${ancho} ${alto}`} style={{ minWidth: ancho }} aria-label={`${titulo}, ${estilos[estilo][0]}`}>
        <defs><linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2d8571" stopOpacity=".28" /><stop offset="100%" stopColor="#2d8571" stopOpacity=".03" /></linearGradient></defs>
        {[0, .25, .5, .75, 1].map(t => <g key={t} aria-hidden="true"><line x1={izq} x2={ancho - der} y1={y(t * max)} y2={y(t * max)} stroke="#dce6e1" strokeDasharray={t ? "4 5" : undefined} /><text x={izq - 10} y={y(t * max) + 4} textAnchor="end">{monetario ? `Q${(max * t).toLocaleString("es-GT", { maximumFractionDigits: 0 })}` : (max * t).toLocaleString("es-GT", { maximumFractionDigits: 1 })}</text></g>)}
        {estilo === "area" && <polygon points={`${x(0)},${base} ${puntos} ${x(datos.length - 1)},${base}`} fill={`url(#${gradiente})`} />}
        {(estilo === "lineas" || estilo === "area") && <polyline points={puntos} fill="none" stroke="#227664" strokeWidth="3" strokeLinejoin="round" />}
        {datos.map((d, i) => <g key={d.id}>
          {estilo === "columnas" ? <g {...interaccion(d)} className="grafica-marca"><rect x={x(i) - (ancho - izq - der) / datos.length * .32} y={y(d.valor)} width={(ancho - izq - der) / datos.length * .64} height={base - y(d.valor)} rx="4" fill={seleccion === d.id ? "#c48a35" : "#227664"} /><rect x={x(i) - 9} y={arriba} width="18" height={base - arriba} fill="transparent" /><title>{describir(d)}</title></g> : <circle {...interaccion(d)} className="grafica-marca" cx={x(i)} cy={y(d.valor)} r={seleccion === d.id ? 6 : (datos.length > 15 ? 3 : 5)} fill={seleccion === d.id ? "#c48a35" : "#fff"} stroke="#227664" strokeWidth="2"><title>{describir(d)}</title></circle>}
          {(i % Math.max(1, Math.ceil(datos.length / (ventas ? (anchoDisponible < 400 ? 4 : 7) : 10))) === 0 || i === datos.length - 1) && <text x={x(i)} y={base + 24} textAnchor="middle" aria-hidden="true">{ventas ? d.nombre : d.id}</text>}
        </g>)}
      </svg></div>}
      {ancho > anchoDisponible + 1 && ["lineas", "area", "columnas"].includes(estilo) && <p className="grafica-fuente">Desliza la gráfica hacia los lados para recorrer todo el período.</p>}
      <div className="grafica-detalle" aria-live="polite">{elegido ? <><strong>{elegido.nombre}</strong><span>{elegido.detalle} · {formato(elegido.valor)}{ventas ? (monetario ? " vendidos" : " ventas") : " unidades vendidas"}</span></> : <><strong>Explora los datos</strong><span>Pasa el cursor, toca un dato o usa Tab y Enter para ver su detalle.</span></>}</div>
    </>}
    <div className="grafica-ayuda" id={ayudaId}><Info size={19} aria-hidden="true" /><div><strong>Cómo leer esta gráfica</strong><p>{instrucciones[estilo]}</p>{mayor?.valor > 0 && <p className="grafica-hallazgo">{ventas ? "El día con mayor valor es" : "El producto más vendido de este grupo es"} <b>{mayor.nombre}</b>, con <b>{formato(mayor.valor)}{ventas ? (monetario ? "" : " ventas") : " unidades"}</b>.</p>}</div></div>
    <p className="grafica-fuente">{ventas ? "Solo pedidos pagados, según la fecha del pedido. El importe puede incluir puntos canjeados; no equivale necesariamente a dinero cobrado." : "Solo unidades de pedidos pagados en el período elegido. Los productos se comparan por cantidad, no por ingresos."}</p>
  </figure>;
}
