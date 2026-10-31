# Entrega 4 — Librería La Crayola Gigante

Fecha de revisión: 29 de octubre de 2026 (Guatemala).

## Alcance

Se trabajó sobre el repositorio local existente, rama `main`, conservando los módulos y reglas de los sprints anteriores. No se reinició el proyecto ni se importaron datos del negocio. Los cambios de Sprint 4 no requieren migraciones del esquema operativo.

## Funcionalidades

| Requisito | Implementación |
| --- | --- |
| Módulos | Usuarios, roles/permisos, clientes, categorías, productos, proveedores, compras/recepción, inventario, pedidos, ventas/pagos, comprobantes y finanzas. |
| Reglas de negocio | Validaciones de existencias, montos, documentos, descuentos, aprobaciones independientes, idempotencia, puntos, IVA incluido y protección del historial. Se conservan las reglas existentes. |
| Roles y permisos | Autenticación JWT y consulta de usuario/rol activos; autorización en API y controles en interfaz. Resumen/reportes requieren `REPORTES_VER`; auditoría general requiere `BITACORA_VER`. Los permisos administrativos no habilitan acceso a empleados. |
| Auditoría | Se amplía a altas, ediciones y estados de usuarios, clientes y productos; categorías; permisos de roles; proveedores; mínimos de inventario y recuperaciones de compras. Se conserva auditoría de pedidos, cobros, compras y finanzas. Los nuevos registros guardan actor, acción, módulo, identificador y detalle acotado, sin contraseñas ni datos laborales. |
| Atomicidad de auditoría | El cambio y su registro de auditoría comparten transacción. Si no se registra la auditoría, el cambio no queda confirmado. No se reconstruyen retrospectivamente eventos anteriores a esta versión. |
| Dashboard e indicadores | Cantidad e importe de ventas pagadas, promedio por venta, productos y clientes activos. |
| Gráficas | Ventas por día y diez productos más vendidos por unidades, con valores legibles y estados vacíos. |
| Reportes | Inventario actual, compras por período y reportes existentes de ventas y productos vendidos. |
| Exportación | CSV con neutralización de fórmulas; vista imprimible para guardar PDF desde el navegador. No se genera un archivo XLSX nativo. |
| Alertas | Productos agotados o bajo mínimo, pedidos pendientes de aprobación y ventas pendientes de pago. |
| Validaciones y errores | Rango válido de hasta 367 días en el nuevo panel, paginación y filtros de auditoría validados, carga/error/reintento, errores JSON y ruta API inexistente. |
| Integración | Compra/recepción actualiza existencias; pago final actualiza inventario, puntos, comprobantes y auditoría; los indicadores y reportes consultan esas mismas tablas. |

## Uso del panel

1. Iniciar sesión con una cuenta administrativa con permisos de reportes o auditoría.
2. En el inicio, seleccionar la tarjeta **Dashboard** del listado de módulos. El resumen operativo, las gráficas, alertas, reportes y auditoría se muestran dentro de este módulo. Usar **Volver al inicio** para regresar.
3. Seleccionar Desde/Hasta y pulsar **Aplicar período**. El período aplicado aparece debajo de los filtros.
4. Consultar indicadores, gráficas y **Ver productos por reabastecer**. **Actualizar resumen** consulta nuevamente los datos.
5. Elegir el tipo de reporte y pulsar **Consultar reporte**. Descargar CSV o usar **Imprimir / guardar PDF**.
6. Expandir **Auditoría de todos los módulos**, filtrar por módulo y avanzar por páginas de 50 eventos.

Las ventas se atribuyen a la fecha del pedido y solo incluyen pedidos pagados. El importe de ventas puede incluir puntos canjeados; no representa necesariamente efectivo cobrado. **Mi dinero** conserva la perspectiva financiera por fecha del cobro, excluyendo puntos. El inventario y las alertas reflejan el estado actual, independientemente del período elegido.

## API nueva

| Método y ruta | Permiso | Parámetros |
| --- | --- | --- |
| GET `/api/dashboard/resumen` | REPORTES_VER | desde, hasta |
| GET `/api/reportes/sprint4/inventario` | REPORTES_VER | desde, hasta (inventario actual) |
| GET `/api/reportes/sprint4/compras` | REPORTES_VER | desde, hasta |
| GET `/api/auditoria` | BITACORA_VER | desde, hasta, pagina (1 por defecto), tabla (opcional) |

Las consultas nuevas usan una transacción de solo lectura con una vista consistente y respuestas `Cache-Control: no-store`. No devuelven credenciales.

## Verificación reproducible

Desde `backend`:

```text
npm run test:unit
npm run test:integration
```

La integración crea un esquema PostgreSQL independiente por suite con nombre aleatorio `sprint4_test_…`, copia la estructura y los catálogos de roles/permisos, inserta datos ficticios y elimina ese esquema al finalizar. No copia usuarios ni operaciones del negocio. Cada transacción de prueba fija su esquema con `SET LOCAL search_path`; no incluye `public` como respaldo. La configuración de conexión se obtiene del `.env` existente sin imprimirla. Se necesita permiso para crear esquemas. Los comandos `test:sprint2` y `test:sprint3` también utilizan este aislamiento.

Desde `frontend`:

```text
npm run lint
npm run build
npx playwright test
```

Las pruebas del navegador simulan respuestas de API; las de integración del backend ejecutan operaciones reales únicamente en el esquema temporal. Son comprobaciones complementarias. Las capturas se guardan en `frontend/test-results`, no en la documentación de entregas anteriores.

## Puesta en marcha

1. Conservar los archivos `.env` actuales y no publicarlos.
2. Ejecutar `npm run build` en `frontend`.
3. Reiniciar el backend con el procedimiento habitual (`npm start` desde `backend`) para cargar las nuevas rutas. El backend sirve el contenido de `frontend/dist`.
4. Revisar el inicio con administrador y empleado. Verificar que las cuentas administrativas tengan los permisos de reportes y bitácora correspondientes.

No se ejecuta una limpieza de datos ni una migración al iniciar esta versión. No se cambian cuentas administrativas, permisos asignados o registros existentes. Los cambios quedan locales para revisión; no se publican ni se envían a GitHub automáticamente.

## Límites de la entrega

- Las gráficas y el inventario se actualizan al abrir el panel o pulsar Actualizar resumen; no son notificaciones push.
- Los reportes se generan con datos actuales y permisos del usuario. La paginación de auditoría no limita los reportes descargados.
- Los comprobantes internos existentes no se convierten en documentos FEL certificados.
- La auditoría nueva registra el tipo de cambio y su registro asociado; no mantiene una copia completa antes/después de cada campo.
- La ejecución de pruebas no certifica por sí sola todos los escenarios de producción ni sustituye la aceptación del usuario.

## Resultados

| Comprobación | Resultado final |
| --- | --- |
| Backend: validaciones, imágenes, adaptador, auditoría y errores HTTP | 24/24 aprobadas |
| Integración Sprint 2 (compras, proveedores, inventario, imágenes y recuperaciones) | 23/23 aprobadas |
| Integración Sprint 3 (pedidos, ventas, pagos, puntos, IVA, concurrencia, finanzas y permisos) | 37/37 aprobadas |
| Integración Sprint 4 (indicadores, reportes, permisos, auditoría y reversión transaccional) | 3/3 aprobadas |
| Navegador: todos los módulos, permisos, reportes y panel operativo | 52/52 aprobadas |
| Comprobación adicional de impresión del reporte | Aprobada dentro de las 3 pruebas de interfaz de Sprint 4 |
| Revisión de código del frontend | Sin advertencias |
| Compilación de producción | Correcta |
| Diferencias de Git | Sin errores de espacios |

Total: 87 pruebas de backend (24 unitarias/HTTP y 63 de integración) y 52 de navegador. La integración final ejecutó las tres suites con esquemas independientes y eliminó los tres al terminar.

La revisión inicial encontró tres pruebas de imágenes que esperaban un saludo antiguo. Se actualizó esa expectativa y se comprobaron sus escenarios completos. La ampliación de auditoría exigió actualizar la limpieza de fixtures de Sprint 2. También se separaron los esquemas por suite para evitar colisiones entre datos ficticios. Estos ajustes quedaron verificados en la ejecución final.

Los archivos `backend/pnpm-lock.yaml` y `frontend/pnpm-lock.yaml` ya estaban sin registrar al comenzar; se conservaron. No se hizo commit, push ni despliegue. La compilación local quedó generada y la guía de puesta en marcha explica cómo cargar los cambios en el servicio habitual.


## Actualización visual — 30 de octubre de 2026

El módulo Dashboard separa **Resumen y gráficas**, **Reportes** y **Auditoría**. Los filtros comunes incluyen Últimos 7 días, Últimos 30 días, Este mes y fechas personalizadas; al escribir fechas hay que pulsar Aplicar período. El inventario y las alertas siguen mostrando el estado actual.

- Ventas: líneas, área, columnas o tabla. La medida puede ser importe vendido en quetzales o número de ventas. Los días sin ventas se muestran en cero dentro del rango, sin unir fechas faltantes como si fueran consecutivas.
- Productos: barras, columnas, dona o tabla, con nombres y códigos. La dona muestra la proporción de unidades dentro de los productos del top 10, no la proporción de todas las ventas.
- Se puede seleccionar un dato con cursor, toque o teclado (Tab/Enter) para consultar su valor. La tabla ofrece los valores exactos.
- Debajo de cada gráfica aparece **Cómo leer esta gráfica**, adaptado al estilo elegido, y una observación calculada sobre el mayor valor.
- **En tarjetas** y **Vista amplia** cambian la distribución. El navegador recuerda la distribución, el estilo de cada gráfica y la medida de ventas. Las preferencias no contienen datos del negocio.
- **Cómo usar el dashboard** abre una guía breve. Los indicadores explican su significado y las alertas distinguen existencias, aprobaciones y pagos pendientes.

Referencias de diseño consultadas: [Datawrapper: líneas para evolución temporal y barras para categorías](https://www.datawrapper.de/academy/what-to-consider-when-creating-line-charts) y [W3C WAI: descripciones y alternativas textuales para gráficas](https://www.w3.org/WAI/tutorials/images/complex/). La separación en secciones y el espaciado son decisiones de diseño aplicadas al flujo de esta librería.

## Reportes y auditoría legibles — 30 de octubre de 2026

Los cuatro reportes muestran Q y dos decimales para importes; las unidades y los identificadores no llevan moneda. Incluyen descripción, guía de lectura, totales de los resultados y filtros locales sobre todas las filas consultadas: búsqueda, proveedor/categoría, estado de pago/inventario, rango de importe, cantidad mínima y orden, según el reporte. CSV y PDF respetan el resultado filtrado. El CSV conserva importes numéricos y especifica (Q) en los encabezados; mantiene la protección contra fórmulas.

Auditoría presenta eventos separados, responsable y registro afectado, acciones en lenguaje cotidiano y detalles estructurados. Cada módulo explica qué actividad registra y qué significa no encontrar eventos. Los filtros de módulo, acción, responsable, detalle y número de registro se aplican en el servidor antes de paginar, con validación y consultas parametrizadas. Las fechas comunes filtran también auditoría.

Al eliminar una cuenta se conserva el nombre completo y nombre de usuario en el evento dentro de la misma transacción. Los eventos antiguos que solo guardaron la cuenta muestran esa cuenta y avisan que el nombre completo no quedó registrado: no se inventan ni reconstruyen datos. No requiere migración. Reiniciar el servicio backend habitual para cargar las nuevas rutas y recargar el navegador; no iniciar otro proceso con un trabajador de correo adicional.

Criterios consultados: [NN/g: estados vacíos que explican y orientan](https://www.nngroup.com/articles/empty-state-interface-design/) y [Carbon: uso de tablas y filtros](https://v10.carbondesignsystem.com/components/data-table/usage/). La organización concreta se adaptó a los módulos de la librería.

Verificación específica: cinco pruebas de formato/filtrado y cinco pruebas de integración de Sprint 4, ejecutadas con un esquema temporal sin datos del negocio y eliminado al terminar. Las pruebas incluyen filtros anteriores a la paginación, nombres al eliminar, permisos y reversión ante fallo de auditoría.
Validación final de esta revisión: compilación y lint correctos; 56 pruebas de navegador aprobadas, además de cinco de formato y filtrado y cinco de integración. Se revisaron capturas de reportes y auditoría en escritorio y móvil.
