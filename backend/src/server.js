require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { probarConexion } = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const usuariosRoutes = require("./routes/usuariosRoutes");
const rolesRoutes = require("./routes/rolesRoutes");
const clientesRoutes = require("./routes/clientesRoutes");
const productosRoutes = require("./routes/productosRoutes");
const categoriasRoutes = require("./routes/categoriasRoutes");

const app = express();

app.use(cors());
app.use("/api/productos", express.json({ limit: "5mb" }));
app.use(express.json());

app.get("/api", (req, res) => {
  res.json({
    proyecto: "Librería La Crayola Gigante",
    mensaje: "Servidor funcionando correctamente",
    estado: "OK",
  });
});

app.use("/api/auth", authRoutes);
app.use('/api/empleado', require('./routes/empleadoRoutes'));
app.use("/api/finanzas", require("./routes/finanzasRoutes"));
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api", require("./routes/pedidosRoutes"));
app.use("/api/ventas", require("./routes/ventasRoutes"));
app.use("/api/productos", productosRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api", require("./routes/sprint2Routes"));

app.use((err, req, res, next) => {
  if (err.type === "entity.too.large")
    return res.status(413).json({ mensaje: "El archivo supera el tamaño permitido" });
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ mensaje: "El cuerpo JSON no es válido" });
  next(err);
});

// Una misma dirección sirve la aplicación y la API en el equipo compartido.
const path = require("node:path");
app.use(express.static(path.join(__dirname, "../../frontend/dist")));

const PORT = process.env.PORT || 3000;

if (require.main === module)
  app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
    probarConexion();
    require("./services/correos").iniciarCorreos();
  });

module.exports = app;
