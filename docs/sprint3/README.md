# Entrega 3 — Sprint 3

Abrir el [informe integrado editable](../Sprint_3_Analisis_de_Sistemas.docx). Reemplaza los seis documentos anteriores y sigue la estructura del informe del Sprint 2.

Incluye portada institucional, índice, planificación, Product Backlog, historias de usuario, Sprint Backlog, tablero Kanban, arquitectura, flujo, estados, modelo relacional, reglas, permisos, pruebas, capturas de la app, seguimiento Scrum, Review, retrospectiva, manual y matriz de cumplimiento.

## Datos cargados el 21/10/2026

- 8 categorías y 40 productos.
- 20 clientes, 4 proveedores y 3 empleados ficticios.
- 4 compras y 64 pedidos: 57 pagados, 3 pendientes de aprobación, 1 aprobado, 1 rechazado, 1 cancelado y 1 con abono.
- 58 ventas, 66 registros de pago y 57 comprobantes.
- 153 movimientos de inventario, 20 movimientos de puntos y 11 movimientos financieros.

Inventario, puntos y pagos conciliados sin diferencias. El conjunto es de demostración; las operaciones no representan ingresos reales del negocio. Las cuentas administrativas existentes se conservaron.

La carga se puede reanudar desde backend con `node scripts/cargarDemostracion.js --cargar`. Su estado y las claves de las cuentas demo se guardan en `.migration-backups/demo-libreria-v1.json`, excluido de Git. No ejecutar la limpieza para iniciar la aplicación.

## Para completar la presentación

Agregar carnés y las capturas indicadas en los recuadros E01–E06 y S01–S03. Completar las decisiones de Review y los acuerdos de retrospectiva. Las capturas del sistema ya incluidas corresponden a la aplicación conectada; los espacios de reuniones se completan con las sesiones realizadas.

Después de editar en Word, actualizar el índice. Las fuentes del informe están en `scripts/documentacion`; regenerarlo sobrescribe las ediciones manuales del Word.
