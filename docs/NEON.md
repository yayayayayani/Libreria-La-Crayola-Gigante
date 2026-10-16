# Neon / PostgreSQL · Guía del equipo

Estado al 15/10/2026, Guatemala: copia de Oracle terminada en Neon, con las 15 tablas y 51 registros originales verificados columna por columna. Se agregó además el marcador `003_oracle_a_postgres` en MIGRACIONES. Oracle no fue modificado. [Informe de copia sin datos personales](sprint2/MIGRACION_NEON_RESULTADO.json).

## Iniciar en este equipo

La configuración privada está en `backend/.env`. `DB_ENGINE=postgres` selecciona Neon; `DATABASE_URL` contiene la conexión de la aplicación y `NEON_DATABASE_URL` la conexión directa administrativa. No copiar esas cadenas en documentos, capturas o Git.

```text
cd backend
npm install
npm start
```

Abrir `http://localhost:3000`. El frontend compilado ya se encuentra en `frontend/dist`; al cambiar React, recompilar desde `frontend` con `npm run build`. Para desarrollo pueden ejecutar el backend y `npm run dev` en frontend; `VITE_API_URL=/api` usa el proxy hacia localhost:3000.

Se conservan los usuarios, hashes de contraseña, roles y permisos existentes. No se crearon contraseñas nuevas para las cuentas reales.

## Uso desde las casas de los compañeros

Cada integrante puede ejecutar su propia copia del código y conectarse a la **misma base `neondb`, rama `production`**. La computadora del propietario puede estar apagada. Una rama distinta de Neon es una copia aislada y no comparte las modificaciones en vivo.

1. Compartir la versión actualizada del repositorio por el mecanismo habitual del equipo. En esta sesión no se hizo commit ni push.
2. Instalar dependencias en backend y frontend.
3. Crear `backend/.env` usando `.env.example`. Mantener `DB_ENGINE=postgres`; proporcionar de forma privada las credenciales de conexión que correspondan al integrante y su `JWT_SECRET`. Las variables `DB_USER`, `DB_PASSWORD`, `DB_CONNECT_STRING` solo se usan con Oracle.
4. Crear `frontend/.env` a partir del ejemplo: únicamente `VITE_API_URL=/api`.
5. Compilar frontend con `npm run build` y ejecutar backend con `npm start`.
6. Entrar con una cuenta personal de la librería que tenga los permisos necesarios. Las operaciones se guardarán en Neon y se reflejarán en los listados de los demás cada cinco segundos.

Para administrar con DBeaver, refrescar la conexión Neon y desplegar `neondb → Schemas → public → Tables`. Los nombres de tablas PostgreSQL aparecen en minúsculas. La aplicación conserva sus campos JSON en mayúsculas para que las pantallas actuales sigan funcionando.

Esto aloja la **base de datos**, no publica una URL de la aplicación. Para entrar desde cualquier navegador sin instalar el proyecto hace falta desplegar Express y React en un hosting; ese despliegue no se realizó en esta sesión. No se necesita Tailscale para que los backend locales accedan a Neon.

## Qué cambió técnicamente

- `database/003_postgres.sql`: estructura completa, claves, índices de correo/factura y restricciones de stock. No inserta catálogos duplicados ni vuelve a recibir compras antiguas.
- `backend/src/config/driver.js`: controlador común con `pg`, consultas parametrizadas, transacciones sobre la misma conexión y compatibilidad con la respuesta de la API existente. Traduce únicamente las construcciones utilizadas en el proyecto; no es un traductor general de SQL Oracle.
- Oracle sigue disponible con `DB_ENGINE=oracle`. No hay sincronización bidireccional: desde el cambio, nuevos registros van a Neon. Volver a Oracle mostraría la copia anterior y perdería de vista los cambios nuevos; no cambiar el motor para trabajar diariamente.
- Los timestamps históricos se copian como hora civil, conservando seis decimales. Las fechas nuevas usan la zona America/Guatemala; al responder la API se interpretan en UTC−06:00. El esquema original Oracle no guardaba una zona horaria por fila.
- TLS valida certificado y nombre del servidor; no se desactiva la verificación. Las credenciales están únicamente en el backend.
- Las secuencias de IDs se ajustaron después de importar. Las pruebas pueden dejar saltos de numeración, comportamiento normal de PostgreSQL; no son registros perdidos.

## Respaldo y migración

Se guardó una copia consistente local en `.migration-backups/`, ignorada por Git. Contiene información privada y hashes de acceso; no compartirla como evidencia académica.

`npm run migrate:neon` sirve para una **base destino vacía**. Primero comprueba acceso, obtiene una lectura consistente Oracle, guarda respaldo y crea/copia/verifica las tablas en una transacción PostgreSQL. Rechaza un destino que ya contenga tablas de la aplicación para evitar sobrescribirlas. No volver a ejecutarlo sobre la base activa ni usar `migrate:sprint2` con PostgreSQL.

`npm run verify:neon` compara el destino con el respaldo de esta migración, excluyendo el marcador nuevo. Es una comprobación de la copia inicial: después de registrar datos reales nuevos es normal que detecte diferencias; no es una orden de restauración.

## Correo y consumo

El SMTP externo sigue pendiente. La activación ahora es explícita con `SMTP_ENABLED=true`, además de las variables SMTP del ejemplo. Se deja desactivado durante la migración para no procesar avisos antiguos. Las pruebas usan SMTP local y no envían mensajes a personas.

Las consultas periódicas, el worker de correo habilitado y las sesiones de DBeaver pueden mantener actividad en Neon. Cerrar sesiones de desarrollo cuando no se utilicen y revisar el consumo del plan gratuito. El pool limita la aplicación a diez conexiones y libera las inactivas.

## Validaciones realizadas

- 8 pruebas del controlador: parámetros, TLS, tipos numéricos, respuesta JSON, transacciones y conflictos.
- 13 pruebas del Sprint 2 ejecutadas contra Neon real: compras, concurrencia, mínimos, duplicados y cola SMTP local.
- 187 casos de permisos y autenticación ejecutados contra Neon real.
- Prueba completa con dos sesiones de Edge: inicio de sesión real → compra desde React → recepción y movimiento en Neon → actualización automática del inventario de la segunda sesión.
- Compilación frontend y lint satisfactorios.

No se ha probado desde las computadoras físicas de los compañeros; deben completar ese ensayo una vez que configuren sus copias.

Comandos desde backend: `npm run test:db`, `npm run test:sprint2`, `npm run test:permissions`, `npm run test:neon:browser`. El último requiere frontend instalado, compilado y Microsoft Edge. Las pruebas crean sus propios datos y los retiran al finalizar.
