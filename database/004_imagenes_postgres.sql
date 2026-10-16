CREATE TABLE IF NOT EXISTS imagenes_productos (
  id_producto BIGINT PRIMARY KEY REFERENCES productos(id_producto) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  actualizado_en TIMESTAMP DEFAULT LOCALTIMESTAMP NOT NULL
);
