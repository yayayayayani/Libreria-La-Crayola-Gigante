import Telefono from "../components/Telefono";
import Documento from "../components/Documento";
import { tipoDocumento, formatearDocumento } from "../services/documentos";
import FotoProducto from "../components/FotoProducto";
import DetalleCompra from "../components/DetalleCompra";
import { useState } from "react";
import api from "../services/api";
import useActualizacion from "../hooks/useActualizacion";

const vacio = {
  tipoDocumento: "NIT",
  nombre: "",
  nit: "",
  correo: "",
  telefono: "",
  direccion: "",
  estado: "A",
};
const linea = () => ({ idProducto: "", cantidad: 1, costo: "", cantidadDanada: 0, observaciones: "" });
// Funciona también sobre HTTP privado, donde randomUUID puede no estar disponible.
const claveOperacion = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
const moneda = (n) => Number(n).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });
export default function ComprasInventario({ token, permisos, onVolver }) {
  const puede = (p) => permisos.includes(p);
  const tabs = [
    puede("PROVEEDORES_GESTIONAR") && "Proveedores",
    puede("COMPRAS_GESTIONAR") && "Compras",
    (puede("INVENTARIO_VER") || puede("INVENTARIO_GESTIONAR")) && "Inventario",
    puede("INVENTARIO_VER") && "Movimientos",
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs.includes("Compras") ? "Compras" : tabs[0]);
  const [pagoCompra, setPagoCompra] = useState("EFECTIVO"), [referenciaPago,setReferenciaPago] = useState("");
  const [proveedores, setProveedores] = useState([]),
    [productos, setProductos] = useState([]),
    [compras, setCompras] = useState([]),
    [inventario, setInventario] = useState([]),
    [movimientos, setMovimientos] = useState([]);
  const [form, setForm] = useState(vacio),
    [editando, setEditando] = useState(null);
  const [idProveedor, setIdProveedor] = useState(""),
    [factura, setFactura] = useState(""),
    [detalles, setDetalles] = useState([linea()]),
    [clave, setClave] = useState(claveOperacion);
  const [detalle, setDetalle] = useState(null),
    [minimos, setMinimos] = useState({}),
    [soloAlertas, setSoloAlertas] = useState(false);
  const [error, setError] = useState(""),
    [mensaje, setMensaje] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const config = { headers: { Authorization: `Bearer ${token}` } };
  const fallo = (e) =>
    setError(
      e.response?.data?.mensaje ||
        "No se pudo conectar. Los datos mostrados pueden estar desactualizados.",
    );
  const cargar = async () => {
    const tareas = [];
    if (puede("PROVEEDORES_GESTIONAR") || puede("COMPRAS_GESTIONAR"))
      tareas.push(api.get("/proveedores", config).then((r) => setProveedores(r.data)));
    if (puede("COMPRAS_GESTIONAR"))
      tareas.push(
        api.get("/catalogo-compras", config).then((r) => setProductos(r.data)),
        api.get("/compras", config).then((r) => setCompras(r.data)),
      );
    if (puede("INVENTARIO_VER") || puede("INVENTARIO_GESTIONAR"))
      tareas.push(api.get("/inventario", config).then((r) => setInventario(r.data)));
    if (puede("INVENTARIO_VER"))
      tareas.push(api.get("/movimientos", config).then((r) => setMovimientos(r.data)));
    await Promise.all(tareas);

  };
  useActualizacion(async () => {
    try {
      await cargar();
    } catch (e) {
      fallo(e);
    }
  }, true);
  const ejecutar = async (fn) => {
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      await fn();
      await cargar();
    } catch (e) {
      fallo(e);
    } finally {
      setOcupado(false);
    }
  };
  const guardarProveedor = (e) => {
    e.preventDefault();
    ejecutar(async () => {
      if (editando) await api.put(`/proveedores/${editando}`, form, config);
      else await api.post("/proveedores", form, config);
      setForm(vacio);
      setEditando(null);
      setMensaje("Proveedor guardado");
    });
  };
  const eliminarProveedor = (p) => {
    if (!window.confirm(`¿Eliminar al proveedor "${p.NOMBRE}"? Esta acción no se puede deshacer.`))
      return;
    ejecutar(async () => {
      const r = await api.delete(`/proveedores/${p.ID_PROVEEDOR}`, config);
      if (editando === p.ID_PROVEEDOR) {
        setEditando(null);
        setForm(vacio);
      }
      if (Number(idProveedor) === p.ID_PROVEEDOR) setIdProveedor("");
      setMensaje(r.data.mensaje);
    });
  };
  const cambiarEstadoProveedor = (p) =>
    ejecutar(async () => {
      const estado = p.ESTADO === "A" ? "I" : "A";
      const r = await api.patch(`/proveedores/${p.ID_PROVEEDOR}/estado`, { estado }, config);
      if (editando === p.ID_PROVEEDOR) setForm((f) => ({ ...f, estado }));
      if (estado === "I" && Number(idProveedor) === p.ID_PROVEEDOR) setIdProveedor("");
      setMensaje(r.data.mensaje);
    });
  const guardarCompra = (e) => {
    e.preventDefault();
    ejecutar(async () => {
      const r = await api.post(
        "/compras",
        {
          idProveedor: Number(idProveedor),
          factura,
          clave,
          pago: pagoCompra === "CREDITO" ? null : { metodo: pagoCompra, referencia: referenciaPago },
          detalles: detalles.map((d) => ({
            idProducto: Number(d.idProducto),
            cantidad: Number(d.cantidad),
            costo: Number(d.costo),
            cantidadDanada: Number(d.cantidadDanada),
            observaciones: d.observaciones,
          })),
        },
        config,
      );
      setMensaje(`${r.data.mensaje}. Compra #${r.data.id}`);
      setFactura(""); setReferenciaPago("");
      setDetalles([linea()]);
      setClave(claveOperacion());
    });
  };
  const editarLinea = (index, campo, valor) =>
    setDetalles((ds) => ds.map((d, i) => (i === index ? { ...d, [campo]: valor } : d)));
  const alertas = inventario.filter((p) => p.ALERTA === 1);
  const tabVisible = tabs.includes(tab) ? tab : tabs[0];
  return (
    <main className="usuarios-page sprint2">
      <button className="btn-volver" onClick={onVolver}>
        ← Volver al menú
      </button>
      <div className="section-heading">

        <h2>Compras e inventario</h2>
      </div>
      {(puede("INVENTARIO_VER") || puede("INVENTARIO_GESTIONAR")) && (
        <div className="productos-resumen">
          <div className="producto-resumen-card">
            <h3>{inventario.length}</h3>
            <p>Productos en inventario</p>
          </div>
          <div className="producto-resumen-card">
            <h3>{inventario.reduce((n, p) => n + Number(p.STOCK), 0)}</h3>
            <p>Unidades disponibles</p>
          </div>
          <div className="producto-resumen-card">
            <h3>{alertas.length}</h3>
            <p>Productos por reponer</p>
          </div>
        </div>
      )}
      <nav className="sprint-tabs" aria-label="Compras e inventario">
        {tabs.map((t) => (
          <button
            key={t}
            aria-pressed={t === tabVisible}
            className={t === tabVisible ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
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
      {tabVisible === "Proveedores" && (
        <>
          <section className="form-panel">
            <h3>{editando ? "Editar proveedor" : "Nuevo proveedor"}</h3>
            <form onReset={()=>{setForm(vacio);setEditando(null);}} className="usuario-form" onSubmit={guardarProveedor}>
              <label style={{ gridColumn: "1 / -1" }}>
                Nombre comercial
                <input
                  required
                  maxLength={150}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </label>
              <Documento
                tipo={form.tipoDocumento}
                valor={form.nit}
                required
                onTipo={(tipoDocumento) => setForm({ ...form, tipoDocumento, nit: "" })}
                onValor={(nit) => setForm({ ...form, nit })}
              />
              <label>
                Correo
                <input
                  type="email"
                  maxLength={120}
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                />
              </label>
              <Telefono
                valor={form.telefono}
                onValor={(telefono) => setForm({ ...form, telefono })}
              />
              <label style={{ gridColumn: "1 / -1" }}>
                Dirección
                <input
                  maxLength={250}
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                />
              </label>
              {editando && (
                <label>
                  Estado
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  >
                    <option value="A">Activo</option>
                    <option value="I">Inactivo</option>
                  </select>
                </label>
              )}
              <div className="form-actions">
                <button className="btn-primary" disabled={ocupado}>
                  Guardar proveedor
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setForm(vacio);
                    setEditando(null);
                  }}
                >
                  Limpiar
                </button>
              </div>
            </form>
          </section>
          <div className="tabla-scroll">
            <table className="usuarios-tabla">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>NIT / DPI</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p) => (
                  <tr key={p.ID_PROVEEDOR}>
                    <td>{p.NOMBRE}</td>
                    <td>{formatearDocumento(p.NIT)}</td>
                    <td>{p.CORREO}</td>
                    <td>{p.ESTADO === "A" ? "Activo" : "Inactivo"}</td>
                    <td>
                      <div className="acciones-usuario">
                        <button
                          disabled={ocupado}
                          className="btn-secondary"
                          onClick={() => {
                            setError("");
                            setMensaje("");
                            setEditando(p.ID_PROVEEDOR);
                            setForm({
                              tipoDocumento: tipoDocumento(p.NIT),
                              nombre: p.NOMBRE,
                              nit: p.NIT,
                              correo: p.CORREO || "",
                              telefono: p.TELEFONO || "",
                              direccion: p.DIRECCION || "",
                              estado: p.ESTADO,
                            });
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-secondary"
                          disabled={ocupado}
                          onClick={() => cambiarEstadoProveedor(p)}
                        >
                          {p.ESTADO === "A" ? "Desactivar" : "Activar"}
                        </button>
                        {!p.COMPRAS_REGISTRADAS && (
                          <button
                            className="btn-secondary"
                            disabled={ocupado}
                            onClick={() => eliminarProveedor(p)}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                      {p.COMPRAS_REGISTRADAS > 0 && (
                        <small>Con compras registradas: puedes desactivarlo.</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!proveedores.length && <p>No hay proveedores registrados.</p>}
          </div>
        </>
      )}
      {tabVisible === "Compras" && (
        <>
          <section className="form-panel">
            <h3>Registrar compra y recepción</h3>
            <form onReset={()=>{setFactura("");setIdProveedor("");setDetalles([linea()]);setReferenciaPago("");setClave(claveOperacion());}} onSubmit={guardarCompra}>
              <h4>1. Datos de la factura</h4>
              <div className="usuario-form">
                <label>
                  Proveedor
                  <select
                    required
                    value={idProveedor}
                    onChange={(e) => setIdProveedor(e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {proveedores
                      .filter((p) => p.ESTADO === "A")
                      .map((p) => (
                        <option key={p.ID_PROVEEDOR} value={p.ID_PROVEEDOR}>
                          {p.NOMBRE}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Serie y número de factura
                  <input
                    required
                    maxLength={80}
                    value={factura}
                    onChange={(e) => setFactura(e.target.value)}
                  />
                </label>
              </div>
              <h4 className="compra-seccion-titulo">2. Productos recibidos</h4>
              {detalles.map((d, i) => (
                <div className="compra-linea" key={i}>
                  <label>
                    Producto {i + 1}
                    <select
                      required
                      value={d.idProducto}
                      onChange={(e) => editarLinea(i, "idProducto", e.target.value)}
                    >
                      <option value="">Seleccionar producto</option>
                      {productos.map((p) => (
                        <option key={p.ID_PRODUCTO} value={p.ID_PRODUCTO}>
                          {p.CODIGO} · {p.NOMBRE}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cantidad
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      required
                      value={d.cantidad}
                      onChange={(e) => editarLinea(i, "cantidad", e.target.value)}
                    />
                  </label>
                  <label>
                    Costo unitario (Q)
                    <input
                      type="number"
                      min="0.01"
                      max="99999999.99"
                      step="0.01"
                      required
                      value={d.costo}
                      onChange={(e) => editarLinea(i, "costo", e.target.value)}
                    />
                  </label>
                  <span>Subtotal: {moneda(Number(d.cantidad) * Number(d.costo))}</span>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={detalles.length === 1}
                    onClick={() => setDetalles((ds) => ds.filter((_, j) => j !== i))}
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
              <h4 className="compra-seccion-titulo">3. Revisión de recepción</h4>
              <p>Estos campos son opcionales. Si todo llegó bien, puedes dejarlos vacíos.</p>
              <div className="recepcion-lista">
                {detalles.map((d, i) => (
                  <section className="recepcion-producto" key={i}>
                    <div className="recepcion-resumen">
                      <strong>{productos.find((p) => p.ID_PRODUCTO === Number(d.idProducto))?.NOMBRE || `Producto ${i + 1}`}</strong>
                      <span>Recibidas: {d.cantidad || 0}</span>
                      <span>Al inventario: {Math.max(0, Number(d.cantidad) - Number(d.cantidadDanada))} unidades.</span>
                    </div>
                    <div className="recepcion-campos">
                      <label>
                        Unidades dañadas {i + 1} (opcional)
                        <input type="number" min="0" max={d.cantidad} step="1" placeholder="0"
                          value={d.cantidadDanada}
                          onChange={(e) => editarLinea(i, "cantidadDanada", e.target.value)} />
                      </label>
                      <label>
                        Observaciones de recepción {i + 1} (opcional)
                        <textarea maxLength={500} rows={2} placeholder="Añade un comentario si lo necesitas"
                          value={d.observaciones}
                          onChange={(e) => editarLinea(i, "observaciones", e.target.value)} />
                      </label>
                    </div>
                  </section>
                ))}
              </div>
              <p>
                <strong>
                  Total:{" "}
                  {moneda(
                    detalles.reduce(
                      (n, d) => n + Math.round(Number(d.costo) * 100) * Number(d.cantidad),
                      0,
                    ) / 100,
                  )}
                </strong>
              </p>
              <div className="usuario-form"><label>Pago de la compra<select value={pagoCompra} onChange={e=>setPagoCompra(e.target.value)}><option value="EFECTIVO">Pagada en efectivo</option><option value="TARJETA">Pagada con tarjeta</option><option value="TRANSFERENCIA">Pagada por transferencia</option><option value="CREDITO">A crédito / pendiente</option></select></label>{pagoCompra !== "CREDITO" && <label>Referencia de pago<input maxLength="100" value={referenciaPago} onChange={e=>setReferenciaPago(e.target.value)} /></label>}</div>
              <p className="compra-pago-resumen">{pagoCompra === "CREDITO" ? "Queda pendiente de pago." : "El total se descontará del saldo al guardar."}</p>
              <button className="btn-primary" disabled={ocupado}>
                {ocupado ? "Guardando…" : "Confirmar recepción y registrar compra"}
              </button>
            </form>
          </section>
          <h3>Compras recibidas</h3>
          <div className="tabla-scroll">
            <table className="usuarios-tabla">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Proveedor</th>
                  <th>Factura</th>
                  <th>Total</th>
                  <th>Por pagar</th>
                  <th>Pendiente de recuperar</th>
                  <th>Recepción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.ID_COMPRA}>
                    <td>#{c.ID_COMPRA}</td>
                    <td>{c.PROVEEDOR}</td>
                    <td>{c.FACTURA}</td>
                    <td>{moneda(c.TOTAL)}</td>
                    <td>{moneda(c.PENDIENTE_PAGO ?? c.TOTAL)}</td>
                    <td>{moneda(c.PENDIENTE_RECUPERAR || 0)}</td>
                    <td>
                      #{c.ID_RECEPCION} · {c.ESTADO}
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          ejecutar(async () => {
                            setDetalle((await api.get(`/compras/${c.ID_COMPRA}`, config)).data);
                          })
                        }
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!compras.length && <p>No hay compras registradas.</p>}
          </div>
          {detalle && (
            <DetalleCompra detalle={detalle} token={token} onCerrar={() => setDetalle(null)}
              onActualizar={async () => {
                setDetalle((await api.get(`/compras/${detalle.compra.ID_COMPRA}`, config)).data);
                await cargar();
              }} />
          )}
        </>
      )}
      {tabVisible === "Inventario" && (
        <>
          <p className={alertas.length ? "error-message" : "alerta-exito"} role="status">
            {alertas.length} productos activos por debajo de su mínimo (10 unidades por defecto).
          </p>
          <label>
            <input
              type="checkbox"
              checked={soloAlertas}
              onChange={(e) => setSoloAlertas(e.target.checked)}
            />{" "}
            Mostrar solo alertas
          </label>
          <div className="tabla-scroll">
            <table className="usuarios-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Existencia</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                  {puede("INVENTARIO_GESTIONAR") && <th>Configurar mínimo</th>}
                </tr>
              </thead>
              <tbody>
                {(soloAlertas ? alertas : inventario).map((p) => (
                  <tr key={p.ID_PRODUCTO}>
                    <td>
                      <div className="producto-identidad">
                        <FotoProducto
                          id={p.ID_PRODUCTO}
                          token={token}
                          nombre={p.NOMBRE}
                          version={p.IMAGEN_ACTUALIZADA || 0}
                        />
                        <span>
                          {p.CODIGO} · {p.NOMBRE}
                        </span>
                      </div>
                    </td>
                    <td>{p.STOCK}</td>
                    <td>{p.STOCK_MINIMO}</td>
                    <td>{p.ESTADO === "I" ? "Inactivo" : p.ALERTA ? "Reponer" : "Disponible"}</td>
                    {puede("INVENTARIO_GESTIONAR") && (
                      <td>
                        <form
                          onReset={()=>setMinimos(actual=>({...actual,[p.ID_PRODUCTO]:p.STOCK_MINIMO}))}
                          className="minimo-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            ejecutar(async () => {
                              await api.patch(
                                `/inventario/${p.ID_PRODUCTO}/minimo`,
                                {
                                  minimo: Number(minimos[p.ID_PRODUCTO] ?? p.STOCK_MINIMO),
                                },
                                config,
                              );
                              setMensaje("Mínimo actualizado");
                            });
                          }}
                        >
                          <input
                            aria-label={`Mínimo de ${p.NOMBRE}`}
                            type="number"
                            min="10"
                            max="9999999999"
                            step="1"
                            required
                            value={minimos[p.ID_PRODUCTO] ?? p.STOCK_MINIMO}
                            onChange={(e) =>
                              setMinimos({
                                ...minimos,
                                [p.ID_PRODUCTO]: e.target.value,
                              })
                            }
                          />
                          <button className="btn-secondary" disabled={ocupado}>
                            Guardar
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!(soloAlertas ? alertas : inventario).length && (
              <p className="sin-datos">
                {soloAlertas
                  ? "No hay productos pendientes de reposición."
                  : "No hay productos registrados."}
              </p>
            )}
          </div>
        </>
      )}
      {tabVisible === "Movimientos" && (
        <div className="tabla-scroll">
          <table className="usuarios-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Antes</th>
                <th>Después</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.ID_MOVIMIENTO}>
                  <td>{new Date(m.FECHA).toLocaleString("es-GT")}</td>
                  <td>{m.NOMBRE}</td>
                  <td>{m.TIPO}</td>
                  <td>{m.CANTIDAD}</td>
                  <td>{m.STOCK_ANTERIOR}</td>
                  <td>{m.STOCK_NUEVO}</td>
                  <td>
                    {m.ID_VENTA
                      ? `Venta #${m.ID_VENTA}`
                      : m.ID_COMPRA
                        ? `Compra #${m.ID_COMPRA} / #${m.ID_RECEPCION}`
                        : "Saldo inicial"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!movimientos.length && <p>No hay movimientos registrados.</p>}
        </div>
      )}
    </main>
  );
}
