import RecuperacionCompra from "./RecuperacionCompra";
import PagoCompra from './PagoCompra';
const moneda = (n) => Number(n).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });
const fecha = (valor) => valor
  ? new Date(valor).toLocaleString("es-GT", { timeZone: "America/Guatemala" })
  : "No disponible";

export default function DetalleCompra({ detalle, onCerrar, token, onActualizar }) {
  const { compra, recepcion, detalles } = detalle;
  const recibidas = detalles.reduce((n, d) => n + Number(d.CANTIDAD), 0);
  const rechazadas = detalles.reduce((n, d) => n + Number(d.CANTIDAD_DANADA || 0), 0);
  const valorRechazado = detalles.reduce(
    (n, d) => n + Number(d.CANTIDAD_DANADA || 0) * Math.round(Number(d.COSTO) * 100), 0,
  ) / 100;
  return (
    <section className="form-panel detalle-compra" aria-label={`Detalle de compra ${compra.ID_COMPRA}`}>
      <div className="detalle-compra-cabecera">
        <div>
          <h3>Compra #{compra.ID_COMPRA}</h3>
          <p>{rechazadas > 0 ? "Recepción con productos rechazados" : "Recepción sin productos rechazados"}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onCerrar}>Cerrar detalle</button>
      </div>
      <dl className="detalle-compra-datos">
        <div><dt>Proveedor</dt><dd>{compra.PROVEEDOR || "No disponible"}</dd></div>
        <div><dt>NIT / DPI del proveedor</dt><dd>{compra.PROVEEDOR_NIT || "No disponible"}</dd></div>
        <div><dt>Factura</dt><dd>{compra.FACTURA}</dd></div>
        <div><dt>Registrada por</dt><dd>{compra.REGISTRADO_POR || "No disponible"}</dd></div>
        <div><dt>Fecha de compra</dt><dd>{fecha(compra.FECHA)}</dd></div>
        <div><dt>Recepción #{recepcion.ID_RECEPCION}</dt><dd>{fecha(recepcion.FECHA)}</dd></div>
      </dl>
      <div className="detalle-compra-resumen">
        <div><span>Unidades recibidas</span><strong>{recibidas}</strong></div>
        <div><span>Aceptadas · ingresadas al inventario</span><strong>{recibidas - rechazadas}</strong></div>
        <div className={rechazadas ? "detalle-rechazadas" : ""}><span>Rechazadas · no ingresadas</span><strong>{rechazadas}</strong></div>
        <div><span>Total de factura</span><strong>{moneda(compra.TOTAL)}</strong></div>
      </div>
      <PagoCompra key={compra.ID_COMPRA + '-' + compra.PENDIENTE_PAGO} compra={compra} token={token} onActualizar={onActualizar} />
      <h4>Productos</h4>
      <div className="tabla-scroll">
        <table className="usuarios-tabla">
          <thead><tr>
            <th>Producto</th><th>Recibidas</th><th>Aceptadas</th><th>Rechazadas</th>
            <th>Costo unitario</th><th>Subtotal facturado</th><th>Valor rechazado</th><th>Resultado</th>
          </tr></thead>
          <tbody>{detalles.map((d) => {
            const danadas = Number(d.CANTIDAD_DANADA || 0);
            return <tr key={d.ID_DETALLE}>
              <td><strong>{d.NOMBRE}</strong><small className="detalle-codigo">{d.CODIGO || "Sin código"}</small></td>
              <td>{d.CANTIDAD}</td><td>{d.CANTIDAD - danadas}</td><td>{danadas}</td>
              <td>{moneda(d.COSTO)}</td><td>{moneda(d.CANTIDAD * d.COSTO)}</td>
              <td>{moneda(danadas * d.COSTO)}</td>
              <td>{danadas === 0 ? "Aceptado" : danadas === Number(d.CANTIDAD) ? "Rechazo total" : "Rechazo parcial"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <h4>Observaciones de recepción</h4>
      <div className="detalle-observaciones">
        {detalles.map((d) => (
          <div key={d.ID_DETALLE}>
            <strong>{d.NOMBRE}</strong>
            <p>{d.OBSERVACIONES || "Sin observaciones registradas."}</p>
          </div>
        ))}
      </div>
      <div className="detalle-compra-importes">
        <p>Valor de unidades aceptadas: <strong>{moneda(Number(compra.TOTAL) - valorRechazado)}</strong></p>
        <p>Valor de unidades rechazadas: <strong>{moneda(valorRechazado)}</strong></p>
      </div>
      <RecuperacionCompra key={compra.ID_COMPRA} detalle={detalle} token={token} onActualizar={onActualizar} />
    </section>
  );
}
