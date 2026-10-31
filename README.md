# Librería La Crayola Gigante

Sistema de gestión de librería con React, Express y PostgreSQL/Neon. Equipo: David García, Yordy Carreto y Daylin Loarca.

## Puesta en marcha

Seguir la [guía de conexión](docs/NEON.md): instalar dependencias en backend y frontend, configurar sus archivos .env y ejecutar npm run dev en cada carpeta. La base compartida ya tiene aplicadas las migraciones del Sprint 3. No ejecutar scripts de importación o limpieza para iniciar el servidor.

## Funciones

- Personal, roles, permisos, clientes, productos y proveedores.
- Compras, recepción, inventario y pagos a proveedores.
- Pedidos, aprobación de descuentos, ventas y pagos combinados.
- Clientes registrados con puntos; venta a consumidor final o con NIT sin crear cuenta.
- IVA incluido y comprobantes internos imprimibles; no son facturas FEL certificadas.
- Mi dinero: ingresos, egresos, saldo y filtros de fechas, restringido a administración.
- Auditoría, búsquedas y reportes descargables en CSV.

La salida de inventario ocurre al completar el pago. Las restricciones se verifican en el backend, además de las vistas del frontend. Administrador y Dueño tienen acceso administrativo; Empleado dispone de las funciones autorizadas y su información personal.

## Sprint 4

El inicio incorpora un resumen operativo con indicadores, gráficas, alertas, reportes CSV e impresión/PDF, y auditoría general paginada. Los cambios de catálogos se auditan en la misma transacción. Consultar [implementación, uso y verificación de Sprint 4](docs/SPRINT4.md).

## Entrega y documentación

Consultar el [índice de documentos](docs/README.md) y el [informe integrado del Sprint 3](docs/Sprint_3_Analisis_de_Sistemas.docx), con planificación, modelo, reglas, pruebas, Scrum, manual, capturas de la aplicación y revisión de cumplimiento. Sigue la estructura de la entrega del Sprint 2.

Verificación del 20/10/2026: 37 pruebas del backend y 34 del navegador aprobadas; lint y compilación correctos. Las pruebas del navegador utilizan respuestas de API simuladas. El 21/10/2026 se cargaron datos ficticios relacionados: 40 productos, 20 clientes, cuatro proveedores, tres empleados y 64 pedidos, incluidos 57 pagados. Se comprobaron inventario, pagos y puntos sin diferencias; las cuentas administrativas existentes se conservaron.

## Pruebas

Desde backend: `npm run test:unit` y `npm run test:integration`. La integración crea y elimina un esquema temporal aislado con datos ficticios; requiere permiso para crear esquemas. Los comandos `test:sprint2` y `test:sprint3` también usan este aislamiento. Desde frontend: `npx playwright test`, `npm run lint` y `npm run build`.

Los registros de prueba y respaldos privados no forman parte de la entrega. Las fuentes y el generador de documentos están en scripts/documentacion. No publicar .env, contraseñas ni respaldos.
