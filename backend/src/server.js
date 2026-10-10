
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
app.use(express.json());

app.get("/api", (req, res) => {
  res.json({
    proyecto: "Librería La Crayola Gigante",
    mensaje: "Servidor funcionando correctamente",
    estado: "OK"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/categorias", categoriasRoutes);

const PORT = process.env.PORT || 3000;

if (require.main === module) app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
  probarConexion();
});

module.exports = app;
