# Entrega 2 · Sprint 2 · Compras e inventario

Fecha de actualización: 15 de octubre de 2026 (Guatemala).

Actualización posterior: la base activa se migró a Neon/PostgreSQL. Consultar [NEON.md](../NEON.md) para iniciar el sistema y trabajar desde distintas casas. La documentación Oracle de esta entrega describe la implementación original y el respaldo.

El incremento agrega al Sprint 1 el flujo proveedor → compra → detalle → recepción completa → entrada de inventario. Registrar una compra significa confirmar que sus productos ya fueron recibidos. Una sola transacción guarda todos los registros y suma las existencias; si falla, se revierte todo. No hay recepción parcial ni órdenes pendientes en este alcance.

## Documentos de entrega

- [Product Backlog, historias y Sprint Backlog](BACKLOG.md).
- [Reglas de negocio y validaciones](REGLAS.md).
- [Diagramas y modelo de datos](MODELO_Y_DIAGRAMAS.md).
- [Casos de prueba y evidencia técnica](PRUEBAS.md).
- [Daily Scrum, Sprint Review y Retrospective](SCRUM.md).
- [Conexión entre tres casas y correo real](DESPLIEGUE.md).

## Puesta en marcha

1. Mantener el esquema del Sprint 1; para una instalación nueva, el SQL base está en `docs/Libreria_La_Crayola_Gigante_Sprint1_Oracle.sql`.
2. En `backend`, ejecutar `npm install` y configurar `.env` con el ejemplo. No reemplazar credenciales existentes.
3. Ejecutar `npm run migrate:sprint2`. Esta migración ya se aplicó en el Oracle local durante la implementación. Registra su versión y una segunda ejecución no repite los datos.
4. En `frontend`, ejecutar `npm install` y `npm run build`.
5. En `backend`, ejecutar `npm start`; abrir `http://localhost:3000`.
6. Entrar con un administrador existente. La migración asigna los cuatro permisos nuevos al rol administrador (`ID_ROL=1`, convención existente). Desde Roles y Permisos asignar al personal las operaciones necesarias.

Oracle confirma DDL implícitamente: respaldar antes de aplicar en otro servidor. El migrador detecta correos duplicados de clientes antes de modificar el esquema; no borra ni fusiona clientes. Si el esquema de otra instalación difiere del Sprint 1, revisar sus columnas antes de migrar. Los correos de usuarios existentes se mantienen vacíos; completar al editar, sin inventar direcciones.

## Límites verificables

El código y la migración están implementados. La conexión remota requiere que el equipo elija y configure el anfitrión. El envío externo requiere SMTP: las credenciales no estaban configuradas al implementar. La documentación de Scrum incluye guiones y espacios para registrar las reuniones reales, sin atribuir reuniones o aprobaciones inexistentes.
