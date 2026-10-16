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

## Puesta en marcha vigente (Neon)

1. Seguir [NEON.md](../NEON.md) y conservar la configuración privada de backend/.env.
2. Instalar dependencias en backend y frontend después de actualizar el código.
3. En backend, ejecutar `npm run migrate:images` para preparar fotografías. La migración es aditiva; ya se aplicó en la base usada en esta revisión.
4. En frontend, ejecutar `npm run build`.
5. En backend, ejecutar `npm start` y abrir http://localhost:3000.

No ejecutar `migrate:sprint2` sobre PostgreSQL; ese comando pertenece a Oracle. El SQL original se conserva como referencia histórica.

## Documentos editables

El [paquete Word de Entrega 2](../entrega2/README.md) contiene planificación, diseño, pruebas, actas, manual e informe de auditoría. La asignación de cierre corresponde a David (compras), Yordy (inventario y pruebas) y Daylin (interfaz y documentación). Las actas requieren las evidencias reales del equipo.

## Límites verificables

El código y la migración están implementados. Neon comparte la base; falta el ensayo desde las tres computadoras físicas. No se publicó una URL de la aplicación. El envío externo requiere SMTP: las credenciales no estaban configuradas al implementar. La documentación de Scrum incluye guiones y espacios para registrar las reuniones reales, sin atribuir reuniones o aprobaciones inexistentes.
