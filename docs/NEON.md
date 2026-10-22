# Conexión al sistema

El motor activo es PostgreSQL en Neon. Cada integrante ejecuta el backend y frontend localmente y utiliza la base acordada. Los cambios en una base compartida son visibles para todos.

## Backend

Desde `backend`, instalar dependencias con `npm install`. Crear `.env` a partir de `backend/.env.example` y configurar `DB_ENGINE=postgres`, `DATABASE_URL` con la conexión privada de Neon, `JWT_SECRET` con un secreto seguro y `PORT=3000`. No publicar el archivo ni incluirlo en capturas. Iniciar con `npm run dev`.

La base compartida ya tiene aplicadas las migraciones hasta el Sprint 3. No repetir migraciones de importación ni la limpieza para iniciar el sistema. Para una instalación nueva, revisar los scripts de `backend/scripts` y el manual Word antes de aplicar cambios al esquema.

## Frontend

Desde `frontend`, ejecutar `npm install`. Configurar `.env` con `VITE_API_URL=http://localhost:3000/api`. Iniciar con `npm run dev` y abrir la dirección que muestra Vite.

## Primer uso

Ingresar con una cuenta administrativa conservada. Registrar personal, categorías, productos, proveedores y clientes según corresponda. Registrar compras para ingresar existencias y el saldo inicial en Mi dinero. Las cuentas de los clientes son registros comerciales; no permiten iniciar sesión.

Consultar la sección 8 del [informe editable del Sprint 3](Sprint_3_Analisis_de_Sistemas.docx) para operación, permisos y solución de problemas. Después de la limpieza del 20/10/2026 se cargó un conjunto de demostración el 21/10/2026. Actualmente la base contiene productos, clientes, compras, ventas y movimientos ficticios relacionados. Los respaldos privados se encuentran fuera de `docs`.
