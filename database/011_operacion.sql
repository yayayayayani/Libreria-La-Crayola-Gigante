ALTER TABLE usuarios ADD sueldo NUMERIC(12,2) CHECK(sueldo>=0);
ALTER TABLE usuarios ADD horario VARCHAR(250);
ALTER TABLE usuarios ADD puesto VARCHAR(100);
ALTER TABLE compras ADD solicitud TEXT;
ALTER TABLE movimientos_financieros ADD CONSTRAINT ck_finanza_relacion CHECK (
 (categoria='COMPRA' AND id_compra IS NOT NULL AND tipo='EGRESO') OR
 (categoria IN ('GASTO','RETIRO') AND id_compra IS NULL AND tipo='EGRESO') OR
 (categoria='OTRO_INGRESO' AND id_compra IS NULL AND tipo='INGRESO') OR
 (categoria='SALDO_INICIAL' AND id_compra IS NULL AND tipo='APERTURA')
);
INSERT INTO migraciones(nombre) VALUES ('011_operacion');
