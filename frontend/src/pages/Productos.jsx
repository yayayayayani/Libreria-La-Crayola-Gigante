
import { useEffect, useState } from "react";
import {
  ArrowLeft, Plus, Pencil, Save, Search, Package
} from "lucide-react";
import api from "../services/api";

const inicial = {
  codigo: "",
  nombre: "",
  descripcion: "",
  precio: "",
  stock: "0",
  idCategoria: ""
};

function Productos({ token, onVolver, permisos = [] }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [formulario, setFormulario] = useState(inicial);
  const [editando, setEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const puedeVer = permisos.includes("PRODUCTOS_VER");
  const puedeCrear = permisos.includes("PRODUCTOS_CREAR");
  const puedeEditar = permisos.includes("PRODUCTOS_EDITAR");

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const mensajeError = (err) =>
    err.response?.data?.mensaje ||
    "No se pudo completar la operación";

  const cargarDatos = async () => {
    const [resProductos, resCategorias] = await Promise.all([
      puedeVer ? api.get("/productos", config) : Promise.resolve({ data: [] }),
      api.get("/categorias", config)
    ]);

    setProductos(resProductos.data);
    setCategorias(resCategorias.data);
  };

  useEffect(() => {
    let vigente = true;
    const opciones = { headers: { Authorization: `Bearer ${token}` } };
    Promise.all([
      puedeVer ? api.get("/productos", opciones) : Promise.resolve({ data: [] }),
      api.get("/categorias", opciones)
    ]).then(([productos, categorias]) => {
      if (vigente) { setProductos(productos.data); setCategorias(categorias.data); }
    }).catch(err => { if (vigente) setError(mensajeError(err)); });
    return () => { vigente = false; };
  }, [token, puedeVer]);

  const nuevoProducto = () => {
    if (!puedeCrear) return;
    setFormulario({ ...inicial });
    setEditando(null);
    setMensaje("");
    setError("");
    setMostrarFormulario(true);
  };

  const editarProducto = (p) => {
    setFormulario({
      codigo: p.CODIGO,
      nombre: p.NOMBRE,
      descripcion: p.DESCRIPCION || "",
      precio: String(p.PRECIO),
      stock: String(p.STOCK),
      idCategoria: String(p.ID_CATEGORIA)
    });

    setEditando(p.ID_PRODUCTO);
    setMensaje("");
    setError("");
    setMostrarFormulario(true);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    if (!(editando !== null ? puedeEditar : puedeCrear)) return;
    setCargando(true);
    setMensaje("");
    setError("");

    try {
      const datos = {
        ...formulario,
        precio: Number(formulario.precio),
        stock: Number(formulario.stock),
        idCategoria: Number(formulario.idCategoria)
      };

      if (editando !== null) {
        await api.put(
          `/productos/${editando}`, datos, config
        );
        setMensaje("Producto actualizado correctamente");
      } else {
        await api.post("/productos", datos, config);
        setMensaje("Producto registrado correctamente");
      }

      setMostrarFormulario(false);
      await cargarDatos();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  };

  const crearCategoria = async (e) => {
    e.preventDefault();
    if (!puedeCrear) return;
    setError("");
    setMensaje("");

    try {
      await api.post("/categorias", {
        nombre: nuevaCategoria,
        descripcion: ""
      }, config);

      setNuevaCategoria("");
      setMensaje("Categoría creada correctamente");
      await cargarDatos();
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  const cambiarEstado = async (p) => {
    const estado = p.ESTADO === "A" ? "I" : "A";

    if (!window.confirm(
      `¿Deseas ${estado === "A" ? "activar" : "desactivar"} este producto?`
    )) return;

    setError("");
    setMensaje("");

    try {
      await api.patch(
        `/productos/${p.ID_PRODUCTO}/estado`,
        { estado },
        config
      );

      setMensaje("Estado actualizado");
      await cargarDatos();
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  const filtrados = productos.filter((p) =>
    `${p.CODIGO} ${p.NOMBRE} ${p.CATEGORIA}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  const totalUnidades = productos.reduce(
    (suma, p) => suma + Number(p.STOCK), 0
  );

  const agotados = productos.filter(
    (p) => Number(p.STOCK) === 0
  ).length;

  const moneda = (valor) =>
    new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency: "GTQ"
    }).format(valor);

  return (
    <main className="usuarios-page">
      <div className="usuarios-top">
        <div>
          <button className="btn-volver" onClick={onVolver}>
            <ArrowLeft size={18}/> Volver al menú
          </button>
          <h2>Gestión de Productos</h2>
          <p>Inventario de Librería La Crayola Gigante</p>
        </div>

        {puedeCrear && <button className="btn-primary" onClick={nuevoProducto}>
          <Plus size={18}/> Nuevo producto
        </button>}
      </div>

      {puedeVer && <div className="productos-resumen">
        <div className="producto-resumen-card">
          <Package size={22}/>
          <h3>{productos.length}</h3>
          <p>Productos registrados</p>
        </div>

        <div className="producto-resumen-card">
          <Package size={22}/>
          <h3>{totalUnidades}</h3>
          <p>Unidades registradas</p>
        </div>

        <div className="producto-resumen-card">
          <Package size={22}/>
          <h3>{agotados}</h3>
          <p>Productos sin existencias</p>
        </div>
      </div>}

      {mensaje && (
        <div className="alerta-exito" role="status">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {puedeCrear && <section className="form-panel">
        <h3>Registrar categoría</h3>

        <form className="categoria-form" onSubmit={crearCategoria}>
          <input
            placeholder="Ej. Cuadernos, Libros, Escritura..."
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            required
            maxLength={100}
          />

          <button type="submit" className="btn-primary">
            <Plus size={17}/> Crear categoría
          </button>
        </form>
      </section>}

      {mostrarFormulario && (editando !== null ? puedeEditar : puedeCrear) && (
        <section className="form-panel">
          <h3>
            {editando !== null
              ? "Modificar producto"
              : "Registrar producto"}
          </h3>

          <form className="usuario-form" onSubmit={guardarProducto}>
            <label>
              Código
              <input
                value={formulario.codigo}
                required
                onChange={(e) => setFormulario({
                  ...formulario,
                  codigo: e.target.value
                })}
              />
            </label>

            <label>
              Nombre del producto
              <input
                value={formulario.nombre}
                required
                onChange={(e) => setFormulario({
                  ...formulario,
                  nombre: e.target.value
                })}
              />
            </label>

            <label>
              Categoría
              <select
                value={formulario.idCategoria}
                required
                onChange={(e) => setFormulario({
                  ...formulario,
                  idCategoria: e.target.value
                })}
              >
                <option value="">Seleccionar categoría</option>
                {categorias
                  .filter((c) => c.ESTADO === "A")
                  .map((c) => (
                    <option
                      key={c.ID_CATEGORIA}
                      value={c.ID_CATEGORIA}
                    >
                      {c.NOMBRE}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Precio de venta (Q)
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formulario.precio}
                onChange={(e) => setFormulario({
                  ...formulario,
                  precio: e.target.value
                })}
              />
            </label>

            <label>
              Existencias
              <input
                type="number"
                min="0"
                step="1"
                required
                value={formulario.stock}
                onChange={(e) => setFormulario({
                  ...formulario,
                  stock: e.target.value
                })}
              />
            </label>

            <label>
              Descripción
              <input
                value={formulario.descripcion}
                onChange={(e) => setFormulario({
                  ...formulario,
                  descripcion: e.target.value
                })}
              />
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMostrarFormulario(false)}
              >
                Cancelar
              </button>

              <button
                className="btn-primary"
                type="submit"
                disabled={cargando}
              >
                <Save size={17}/>
                {cargando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </section>
      )}

      {puedeVer && <section className="usuarios-tabla-panel">
        <div className="buscar-campo">
          <Search size={19}/>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto, código o categoría..."
          />
        </div>

        <div className="tabla-scroll">
          <table className="usuarios-tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtrados.map((p) => (
                <tr key={p.ID_PRODUCTO}>
                  <td>{p.CODIGO}</td>
                  <td>{p.NOMBRE}</td>
                  <td>{p.CATEGORIA}</td>
                  <td>{moneda(p.PRECIO)}</td>
                  <td>
                    {p.STOCK === 0
                      ? <span className="estado-inactivo">Agotado</span>
                      : p.STOCK}
                  </td>
                  <td>
                    <span className={
                      p.ESTADO === "A"
                        ? "estado-activo"
                        : "estado-inactivo"
                    }>
                      {p.ESTADO === "A" ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    {puedeEditar && <div className="acciones-usuario">
                      <button
                        className="btn-editar"
                        onClick={() => editarProducto(p)}
                        title="Editar producto"
                      >
                        <Pencil size={16}/>
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => cambiarEstado(p)}
                      >
                        {p.ESTADO === "A"
                          ? "Desactivar"
                          : "Activar"}
                      </button>
                    </div>}
                  </td>
                </tr>
              ))}

              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="sin-datos">
                    No se encontraron productos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>}
    </main>
  );
}

export default Productos;
