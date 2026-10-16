# Product Backlog actualizado

Prioridad: P1 obligatoria, P2 siguiente incremento. Los puntos son una propuesta de estimación, no horas ni votaciones del equipo.

| ID | Necesidad | Prioridad | Estado técnico |
|---|---|---|---|
| PB01 | Autenticación, usuarios, roles y permisos | P1 | Sprint 1; regresión verificada |
| PB02 | Clientes, productos y categorías | P1 | Sprint 1; validaciones ampliadas |
| PB03 | Proveedores activos e inactivos | P1 | Implementado Sprint 2 |
| PB04 | Compras con factura y múltiples detalles | P1 | Implementado Sprint 2 |
| PB05 | Recepción completa y entrada automática | P1 | Implementado Sprint 2 |
| PB06 | Existencias, mínimos y alertas | P1 | Implementado Sprint 2 |
| PB07 | Historial de movimientos | P1 | Implementado Sprint 2 |
| PB08 | Restricciones de nombres, NIT y correo único | P1 | Implementado Sprint 2 |
| PB09 | Notificaciones por correo real | P1 | Cola y SMTP implementados; activación externa pendiente |
| PB10 | Tres usuarios desde casas distintas | P1 | Neon compartido configurado; ensayo en tres laptops pendiente |
| PB11 | Recepciones parciales, devoluciones y ajustes | P2 | Pendiente |
| PB12 | Ventas y facturación | P2 | Pendiente |
| PB13 | Consulta de bitácora y exportaciones | P2 | Pendiente; los permisos previos no implican funcionalidad |

## Historias de usuario

| Historia | Como / quiero / para | Criterios de aceptación | Puntos propuestos |
|---|---|---|---|
| HU-S2-01 | Encargado: gestionar proveedores para conocer quién abastece | Nombre comercial y NIT obligatorios; NIT único; permite editar y desactivar; proveedor inactivo no acepta compras | 3 |
| HU-S2-02 | Encargado: registrar factura y sus productos para documentar compras | Entre 1 y 100 detalles; productos sin repetir; cantidades enteras positivas; costo positivo con dos decimales; total calculado en servidor | 5 |
| HU-S2-03 | Bodeguero: confirmar recepción para actualizar existencias | Registro confirma recepción total; una recepción por compra; movimiento por producto; fallo revierte compra, detalle, recepción y saldos | 5 |
| HU-S2-04 | Encargado: consultar mínimos para reponer productos | Mínimo entero ≥ 0; alerta con stock ≤ mínimo; se resuelve al superar mínimo; inactivos no alertan | 3 |
| HU-S2-05 | Auditor: revisar entradas para explicar el saldo | Historial con fecha, producto, cantidad, saldo anterior/nuevo, compra y recepción; apertura conserva saldo preexistente | 3 |
| HU-S2-06 | Administrador: validar personal y correo para evitar cuentas incorrectas | Nombres personales sin números; correo requerido en altas/ediciones de usuarios; duplicado devuelve 409 incluso con mayúsculas; índice único resiste concurrencia | 3 |
| HU-S2-07 | Usuario: recibir aviso real para enterarme de cambios | Alta/edición encola aviso; reutilización rechazada encola aviso al titular; SMTP reintenta fallos hasta cinco veces; no se anuncia entrega inexistente | 3 |
| HU-S2-08 | Integrante: ver cambios de mis compañeros para trabajar sobre los mismos datos | Cada laptop ejecuta el backend conectado a la misma base PostgreSQL en Neon; consultas cada cinco segundos y al recuperar foco; dos compras simultáneas conservan ambas cantidades | 3 |

## Sprint Backlog

Objetivo: completar la recepción de compras y trazabilidad del inventario sin saldos inconsistentes.

| Tarea | Historias | Resultado | Estado |
|---|---|---|---|
| SB01 · Migración Oracle e índices | 01–07 | `database/002_sprint2.sql` y migrador | Terminado local |
| SB02 · API de proveedores y compras | 01–03 | Rutas protegidas y transacciones | Terminado |
| SB03 · Inventario y movimientos | 04–05 | Saldo, mínimo, alertas e historial | Terminado |
| SB04 · Interfaz y actualización compartida | 01–05,08 | Módulo Compras e inventario y consultas periódicas | Terminado |
| SB05 · Restricciones y correo único | 06 | Formularios, backend e índices Oracle | Terminado |
| SB06 · Cola y envío SMTP | 07 | Worker con reintentos; configurar remitente | Código terminado, activación pendiente |
| SB07 · Pruebas y regresión | Todas | Casos automatizados documentados | Ver PRUEBAS.md |
| SB08 · Documentación | Todas | Backlogs, reglas, modelos y guiones Scrum | Preparada |
| SB09 · Prueba en tres casas | 08 | Actualizar el repositorio, configurar backend/.env y validar acceso a Neon | Pendiente del equipo |
| SB10 · Ceremonias y aceptación | Todas | Evidencias reales y firmas | Pendiente del equipo |

Responsables de cierre asignados el 16/10/2026: David, proveedores y compras; Yordy, inventario y pruebas; Daylin, interfaz y documentación. Esta asignación no atribuye trabajo histórico. Definición de terminado técnico: código, migración, validaciones, permisos y pruebas satisfactorias. La aceptación de la consigna exige además la demostración y actas reales. SMTP y ensayo desde las tres casas son ampliaciones del proyecto con comprobación externa pendiente.

## Ampliación del 16/10/2026

| ID | Historia o tarea | Responsable | Estado |
|---|---|---|---|
| HU-S2-09 | Como encargado, quiero agregar, reemplazar y quitar fotos para reconocer productos | Daylin | Implementada; aceptación del equipo pendiente |
| SB11 | Tabla compartida, validación de imágenes y guardado transaccional | David, revisión de Yordy | Implementado y probado en PostgreSQL |
| SB12 | Diseño adaptable y fotos en catálogo e inventario | Daylin | Implementado; pruebas de navegador |
| SB13 | Auditoría, correcciones y documentos Word | Yordy y Daylin | Revisión técnica preparada; completar datos y actas reales |

Criterios de HU-S2-09: JPEG/PNG/WebP hasta 3 MB y 16 megapíxeles; vista previa; persistencia compartida; rechazo de archivo inválido sin cambios parciales; conservar imagen si se omite y quitarla solo al guardar null; lectura autorizada.
