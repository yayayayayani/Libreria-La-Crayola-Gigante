import ExportarCsv from "../components/ExportarCsv";
import { useState } from "react";
import api from "../services/api";
import useActualizacion from "../hooks/useActualizacion";
import Documento from "../components/Documento";
const claveNueva = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
const clienteVacio = {
  nombres: "",
  apellidos: "",
  tipoDocumento: "NIT",
  nit: "",
  telefono: "",
  correo: "",
  direccion: "",
};
const linea = () => ({ idProducto: "", cantidad: 1 });
const moneda = (n) => Number(n).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });
export default function Ventas({ token, permisos, onVolver }) {
  const [catalogo, setCatalogo] = useState({ productos: [], clientes: [] }),
    [ventas, setVentas] = useState([]);
  const [modo, setModo] = useState("cf"),
    [idCliente, setIdCliente] = useState(""),
    [cliente, setCliente] = useState(clienteVacio);
  const [detalles, setDetalles] = useState([linea()]),
    [clave, setClave] = useState(claveNueva);
  const [ocupado, setOcupado] = useState(false),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState("");
  const config = { headers: { Authorization: `Bearer ${token}` } };
  const cargar = async () => {
    const [c, v] = await Promise.all([
      api.get("/ventas/catalogo", config),
      api.get("/ventas", config),
    ]);
    setCatalogo(c.data);
    setVentas(v.data);
  };
  useActualizacion(async () => {
    try {
      await cargar();
    } catch (e) {
      setError(e.response?.data?.mensaje || "No se pudieron consultar las ventas");
    }
  }, true);
  const guardar = async (e) => {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      const r = await api.post(
        "/ventas",
        {
          modo,
          idCliente: Number(idCliente),
          cliente,
          clave,
          detalles: detalles.map((d) => ({
            idProducto: Number(d.idProducto),
            cantidad: Number(d.cantidad),
          })),
        },
        config,
      );
      setMensaje(`${r.data.mensaje}. Venta #${r.data.id} · ${moneda(r.data.total)}`);
      setModo("cf");
      setIdCliente("");
      setCliente(clienteVacio);
      setDetalles([linea()]);
      setClave(claveNueva());
      await cargar();
    } catch (e) {
      setError(
        e.response?.data?.mensaje ||
          "No se recibió confirmación. Puedes reintentar sin duplicar la venta.",
      );
    } finally {
      setOcupado(false);
    }
  };
  const producto = (id) => catalogo.productos.find((p) => p.ID_PRODUCTO === Number(id));
  const editar = (i, c, v) =>
    setDetalles((ds) => ds.map((d, j) => (i === j ? { ...d, [c]: v } : d)));
  return (
    <main className="usuarios-page sprint2">
      <button className="btn-volver" onClick={onVolver}>
        ← Volver al menú
      </button>
      <h2>Ventas a clientes</h2>
      <p>
        Registra lo que compra un cliente. Al confirmar, se descuentan las unidades del inventario.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="alerta-exito" role="status">
          {mensaje}
        </p>
      )}
      <section className="form-panel">
        <h3>Registrar venta</h3>
        <form onSubmit={guardar}>
          <fieldset disabled={ocupado} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="usuario-form">
              <label>
                Cliente de la venta
                <select value={modo} onChange={(e) => setModo(e.target.value)}>
                  <option value="cf">Consumidor final (CF)</option>
                  <option value="existente">Seleccionar cliente existente</option>
                  {permisos.includes("CLIENTES_CREAR") && (
                    <option value="nuevo">Añadir cliente nuevo</option>
                  )}
                </select>
              </label>
              {modo === "existente" && (
                <label>
                  Cliente
                  <select required value={idCliente} onChange={(e) => setIdCliente(e.target.value)}>
                    <option value="">Seleccionar cliente</option>
                    {catalogo.clientes.map((c) => (
                      <option key={c.ID_CLIENTE} value={c.ID_CLIENTE}>
                        {c.NOMBRES} {c.APELLIDOS} · {c.NIT || "Sin documento"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {modo === "cf" && <p>La venta queda como CF. No se crea un cliente en el sistema.</p>}
            {modo === "nuevo" && (
              <div className="usuario-form">
                <Documento
                  tipo={cliente.tipoDocumento}
                  valor={cliente.nit}
                  onTipo={(tipoDocumento) => setCliente({ ...cliente, tipoDocumento, nit: "" })}
                  onValor={(nit) => setCliente({ ...cliente, nit })}
                />
                {[
                  ["nombres", "Nombres"],
                  ["apellidos", "Apellidos"],
                  ["telefono", "Teléfono"],
                  ["correo", "Correo"],
                  ["direccion", "Dirección"],
                ].map(([c, t]) => (
                  <label key={c}>
                    {t}
                    <input
                      required={c === "nombres"}
                      type={c === "correo" ? "email" : "text"}
                      maxLength={
                        c === "direccion" ? 250 : c === "correo" ? 120 : c === "telefono" ? 25 : 100
                      }
                      value={cliente[c]}
                      onChange={(e) => setCliente({ ...cliente, [c]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            )}
            {detalles.map((d, i) => (
              <div className="compra-linea" key={i}>
                <label>
                  Producto {i + 1}
                  <select
                    required
                    value={d.idProducto}
                    onChange={(e) => editar(i, "idProducto", e.target.value)}
                  >
                    <option value="">Seleccionar producto</option>
                    {catalogo.productos.map((p) => (
                      <option key={p.ID_PRODUCTO} value={p.ID_PRODUCTO}>
                        {p.CODIGO} · {p.NOMBRE} · Stock: {p.STOCK}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad
                  <input
                    type="number"
                    required
                    min="1"
                    max={Math.min(producto(d.idProducto)?.STOCK || 1000000, 1000000)}
                    step="1"
                    value={d.cantidad}
                    onChange={(e) => editar(i, "cantidad", e.target.value)}
                  />
                </label>
                <span>Precio: {moneda(producto(d.idProducto)?.PRECIO || 0)}</span>
                <span>{moneda((producto(d.idProducto)?.PRECIO || 0) * Number(d.cantidad))}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={detalles.length === 1}
                  onClick={() => setDetalles((ds) => ds.filter((_, j) => i !== j))}
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              disabled={detalles.length >= 100}
              onClick={() => setDetalles([...detalles, linea()])}
            >
              Agregar producto
            </button>
            <p>
              <strong>
                Total:{" "}
                {moneda(
                  detalles.reduce(
                    (n, d) =>
                      n +
                      Math.round((producto(d.idProducto)?.PRECIO || 0) * 100) * Number(d.cantidad),
                    0,
                  ) / 100,
                )}
              </strong>
            </p>
            <button className="btn-primary">{ocupado ? "Guardando…" : "Confirmar venta"}</button>
          </fieldset>
        </form>
      </section>
      <h3>Ventas registradas</h3>
      <ExportarCsv filas={ventas} nombre="ventas" columnas={['ID_VENTA', 'FECHA', 'CLIENTE_NOMBRE', 'DOCUMENTO', 'TOTAL']} disabled={ocupado} />
      <div className="tabla-scroll">
        <table className="usuarios-tabla">
          <thead>
            <tr>
              <th>Venta</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>NIT / DPI</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.ID_VENTA}>
                <td>#{v.ID_VENTA}</td>
                <td>{new Date(v.FECHA).toLocaleString("es-GT")}</td>
                <td>{v.CLIENTE_NOMBRE}</td>
                <td>{v.DOCUMENTO || "—"}</td>
                <td>{moneda(v.TOTAL)}</td>
              </tr>
            ))}
            {!ventas.length && (
              <tr>
                <td colSpan={5}>No hay ventas registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
