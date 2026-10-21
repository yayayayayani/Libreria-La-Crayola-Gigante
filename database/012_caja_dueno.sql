ALTER TABLE pedidos ADD receptor_nombre VARCHAR(200);
ALTER TABLE pedidos ADD receptor_nit VARCHAR(20);
ALTER TABLE pedidos ADD CONSTRAINT ck_receptor_pedido CHECK ((receptor_nombre IS NULL AND receptor_nit IS NULL) OR (id_cliente IS NULL AND receptor_nombre IS NOT NULL AND receptor_nit IS NOT NULL));
INSERT INTO roles(id_rol,nombre,descripcion,estado) VALUES (3,'Dueño','Administración y supervisión del negocio','A');
SELECT setval(pg_get_serial_sequence('roles','id_rol'),GREATEST((SELECT MAX(id_rol) FROM roles),nextval(pg_get_serial_sequence('roles','id_rol'))));
INSERT INTO rol_permiso(id_rol,id_permiso) SELECT 3,id_permiso FROM permisos;
INSERT INTO migraciones(nombre) VALUES ('012_caja_dueno');
