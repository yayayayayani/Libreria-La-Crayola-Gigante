CREATE TABLE comprobantes (
 id_venta BIGINT PRIMARY KEY REFERENCES ventas(id_venta) ON DELETE CASCADE,
 contenido TEXT NOT NULL,
 fecha TIMESTAMP NOT NULL DEFAULT LOCALTIMESTAMP
);
INSERT INTO migraciones(nombre) VALUES ('009_comprobantes');
