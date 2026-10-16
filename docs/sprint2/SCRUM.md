# Evidencia de Scrum · Sprint 2

Este documento separa evidencia técnica disponible de ceremonias que deben completar David, Yordy y Daylin. No se han inventado reuniones, horas, intervenciones, acuerdos ni aprobaciones.

## Registro técnico de la sesión de implementación

Fecha: 15/10/2026, Guatemala. Este registro no reemplaza un Daily Scrum entre integrantes.

| Avance comprobable | Evidencia |
|---|---|
| Revisión del esquema Sprint 1 y conexión local a Oracle | Auditoría de columnas realizada sin revelar credenciales |
| Migración Sprint 2 aplicada | `npm run migrate:sprint2`; tabla MIGRACIONES |
| Flujo compra → recepción → movimiento → stock | Pruebas automatizadas de backend y archivos del incremento |
| Conflictos y concurrencia | Pruebas de factura repetida y dos compras simultáneas |
| Validación de nombres y correo único | Pruebas de API y navegador |
| Actualización compartida | Consulta periódica y escenario de cambio externo en navegador |
| Impedimentos externos | Falta configurar remitente SMTP y red entre las tres casas |

## Evidencia de Daily Scrum

Completar una fila por reunión realmente realizada; adjuntar minuta o captura con permiso de los participantes. Duración sugerida: 15 minutos.

| Fecha/hora real | Participantes | Qué avanzamos hacia el objetivo | Qué sigue | Impedimento y responsable | Enlace a evidencia |
|---|---|---|---|---|---|
| Por completar | Por confirmar | Por completar | Por completar | Por completar | Por adjuntar |

Guía para la primera reunión pendiente: revisar el incremento, elegir el equipo anfitrión, distribuir configuración de Tailscale/SMTP y revisión de pruebas. Registrar las decisiones reales, sin copiar una reunión ficticia.

## Sprint Review

Estado: demostración técnica preparada; reunión y aceptación del equipo/docente pendientes.

Guion de demostración:

1. Entrar como administrador y mostrar permisos asignados.
2. Crear un proveedor y un producto con stock inicial conocido.
3. Registrar factura con dos productos y confirmar recepción.
4. Mostrar detalle de compra, recepción y movimientos con saldos anterior/nuevo.
5. Reintentar la factura: debe rechazarla sin alterar saldos.
6. Configurar mínimo, mostrar alerta y resolverla con otra compra.
7. Mostrar rechazo de nombre numérico y correo repetido.
8. Con SMTP ya configurado, mostrar el aviso real recibido por un integrante.
9. Desde los tres equipos, observar el mismo inventario y sus actualizaciones.

| Campo del acta | Completar durante la reunión |
|---|---|
| Fecha, hora y participantes | Pendiente |
| Historias aceptadas / rechazadas y motivo | Pendiente |
| Retroalimentación del docente o usuario | Pendiente |
| Evidencias (capturas/video) | Pendiente |
| Cambios al Product Backlog | Pendiente |

## Sprint Retrospective

Estado: plantilla preparada; conclusiones del equipo pendientes.

Observaciones técnicas para discutir (no acuerdos ya tomados):

- Las transacciones y pruebas de concurrencia previenen diferencias de stock.
- La migración y los ejemplos de configuración evitan configuraciones distintas entre integrantes.
- SMTP y acceso remoto deben probarse antes del día de entrega.
- El correo nuevo requirió actualizar la lista de campos permitidos del middleware; conviene revisar contratos de frontend, API y seguridad juntos.

| Pregunta | Acuerdo real | Responsable | Fecha de seguimiento |
|---|---|---|---|
| ¿Qué funcionó bien? | Pendiente | Pendiente | Pendiente |
| ¿Qué dificultó el Sprint? | Pendiente | Pendiente | Pendiente |
| ¿Qué mejora concreta probaremos? | Pendiente | Pendiente | Pendiente |

No marcar la evidencia de Scrum como terminada hasta adjuntar las reuniones reales.
