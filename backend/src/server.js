
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { probarConexion } = require("./config/database");

probarConexion();

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
