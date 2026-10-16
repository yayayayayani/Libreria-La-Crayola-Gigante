# Compras e inventario: informe de la Entrega 2

## Resumen
La segunda entrega de Librería La Crayola Gigante desarrolla el abastecimiento de productos, desde la identificación del proveedor hasta la entrada de existencias. El propósito es que cada aumento del inventario tenga una explicación verificable: una factura, sus productos, una recepción y los movimientos correspondientes. Esta trazabilidad reduce el riesgo de registrar cantidades dos veces y permite revisar cómo se obtuvo el saldo actual de cada artículo.

El sistema incorpora proveedores, compras con varios productos, recepción completa, inventario, mínimos y alertas. La ampliación de esta revisión añade fotografías de productos y una presentación coherente para las pantallas administrativas. La base compartida es PostgreSQL en Neon; React presenta la información y Express aplica validaciones, permisos y transacciones.

El alcance técnico y la aceptación académica se presentan por separado. Existen pruebas automatizadas y documentos de trabajo, pero la aprobación del incremento, las conclusiones del equipo y las evidencias de reuniones deben registrarse cuando ocurran. Las responsabilidades siguientes se asignan para organizar la revisión y el cierre; no constituyen una atribución retrospectiva de autoría.

## Problema y propósito del incremento
Una compra no debería terminar como una factura aislada. Si el documento se guarda y el inventario no aumenta, la consulta de existencias deja de representar lo recibido. Si el usuario repite el registro por una interrupción de conexión, tampoco debería duplicarse la entrada. Por ello, el proceso reúne la compra, sus detalles, la recepción y los movimientos dentro de una transacción.

El objetivo del Sprint es registrar compras recibidas y mantener existencias confiables, con información suficiente para consultar el origen de cada entrada y detectar productos que requieren reposición. El usuario debe poder completar el proceso desde la interfaz sin efectuar cambios directos en la base de datos.

## Alcance y decisiones
Registrar una compra significa confirmar que los productos ya se recibieron por completo. No existe una compra pendiente que después vuelva a incrementar el inventario. La pantalla informa esta condición antes de guardar y el historial permite consultar la recepción asociada. Las recepciones parciales, devoluciones, ajustes manuales y ventas se reservan para incrementos posteriores.

Las existencias se consultan desde PRODUCTOS. MOVIMIENTOS_INVENTARIO conserva el historial, con saldo anterior, cantidad y saldo nuevo. Mantener una única fuente para el saldo evita que dos tablas de inventario se contradigan. Las fotografías se guardan por separado en IMAGENES_PRODUCTOS para que los listados no transporten archivos completos en cada actualización.

La instalación local de cada integrante puede conectarse a la misma base y rama de Neon. Esta configuración comparte los datos; no equivale a publicar el sitio en internet. La prueba desde las tres computadoras físicas permanece como actividad de aceptación del equipo.

## Organización del equipo
Todos participan en la revisión del incremento. Para el cierre, David coordina el alcance funcional, Yordy facilita el seguimiento y Daylin mantiene la documentación y la coherencia visual. Esta distribución no implica que una sola persona deba ejecutar o aprobar todo su bloque.

| Integrante | Responsabilidad principal | Apoyo y revisión cruzada | Entregable de cierre |
|---|---|---|---|
| David | Proveedores, compras, detalles y recepción | Revisa con Yordy la consistencia de cantidades y totales | Demostración de una compra con dos productos y factura duplicada rechazada |
| Yordy | Inventario, mínimos, movimientos y pruebas | Revisa con Daylin permisos, alertas y visualización | Matriz de pruebas revisada y evidencia del saldo antes y después |
| Daylin | Presentación, fotografías y documentación | Revisa con David que los documentos correspondan a las pantallas | Documentos editados, capturas organizadas y fotografías de productos verificadas |

## Asignación de tareas para completar la entrega
Las tareas se consideran cerradas cuando el responsable presenta evidencia y otro integrante confirma que el resultado satisface el criterio. El código disponible puede estar terminado mientras la demostración y la aceptación siguen pendientes.

| Tarea | Responsable | Revisor | Criterio de cierre | Evidencia |
|---|---|---|---|---|
| T01. Revisar proveedores | David | Daylin | Crear, editar y desactivar sin perder compras anteriores | Capturas E01 y E02 |
| T02. Demostrar compra completa | David | Yordy | Dos detalles, total correcto y una recepción | Capturas E03 y E04 |
| T03. Verificar duplicados | David | Yordy | Reintento rechazado y saldo sin incremento adicional | Captura E05 |
| T04. Revisar inventario | Yordy | David | Saldo final igual al saldo inicial más la compra | Capturas E06 y E07 |
| T05. Probar mínimos y alertas | Yordy | Daylin | Alerta en igualdad y resolución al superar mínimo | Capturas E08 y E09 |
| T06. Revisar movimientos | Yordy | David | Referencia a compra y recepción; saldos conciliados | Captura E10 |
| T07. Cargar fotografías | Daylin | David | Agregar, reemplazar, quitar y consultar desde otro usuario | Capturas E11 y E12 |
| T08. Revisar presentación adaptable | Daylin | Yordy | Formularios legibles y tablas desplazables en teléfono | Captura E13 |
| T09. Ensayo desde tres computadoras | Yordy | David y Daylin | Los tres consultan la misma compra y saldo | Captura E14 y observación escrita |
| T10. Completar documentos | Daylin | David y Yordy | Portadas, responsables, fechas y referencias revisados | Lista de cierre firmada |
| T11. Realizar revisión del Sprint | David | Equipo | Historias aceptadas o rechazadas con motivo | Acta y captura R02 |
| T12. Registrar retrospectiva | Yordy | Equipo | Dos mejoras con responsable y seguimiento | Acta y captura R03 |

## Criterios de terminado
Una funcionalidad está técnicamente terminada cuando puede utilizarse con los permisos correctos, valida entradas, conserva los datos ante errores y supera las pruebas correspondientes. Para una compra, también deben verificarse recepción, detalle y movimientos. La documentación debe describir el comportamiento implementado y distinguir las limitaciones conocidas.

La entrega académica se cierra después de la demostración y de completar las evidencias reales. Si una historia se rechaza, se conserva la observación, se asigna responsable y se incorpora una tarea de corrección. Una captura aislada de una videollamada no demuestra que todas las historias hayan sido aceptadas.

## Backlogs e historias de usuario
Las tablas siguientes conservan la trazabilidad del repositorio. Los puntos son estimaciones propuestas, no resultados de una sesión de estimación que no se haya documentado. El responsable de cada bloque es el indicado en la matriz anterior.

{{BACKLOG}}

## Historia adicional: fotografías de productos
Como encargado de catálogo, quiero agregar una fotografía al producto para reconocerlo durante la consulta y reducir confusiones entre artículos con nombres similares. La fotografía acompaña al código y al nombre; no reemplaza ninguno de estos identificadores.

| Criterio | Comprobación |
|---|---|
| Aceptar archivos compatibles | JPEG, PNG o WebP hasta 3 MB y 16 megapíxeles |
| Confirmar antes de guardar | La imagen seleccionada aparece en vista previa |
| Mantener consistencia | Producto y fotografía se guardan en la misma transacción |
| Conservar fotografía | Una edición que omite imagen no elimina la existente |
| Retirar fotografía | Quitar imagen y guardar deja el producto sin foto |
| Aplicar permisos | La API requiere autenticación y autorización para consulta o edición |
| Compartir la información | Otra sesión autorizada puede consultar la fotografía guardada |

## Riesgos y seguimiento
La conectividad es necesaria para acceder a Neon. Una interrupción debe tratarse como un error de operación o de actualización; no como confirmación de guardado. Ante una respuesta incierta después de registrar una compra, se consulta primero el historial y la factura antes de intentar una operación nueva.

El correo externo requiere configuración y comprobación aparte. No forma parte del flujo obligatorio de compra indicado en la consigna recibida, aunque aparece como ampliación del proyecto. Las evidencias de correo, acceso desde otras casas y reuniones no se presentan como realizadas si todavía están pendientes.

[[CAPTURA:E00|Vista general de la aplicación|Insertar una captura del menú con los módulos habilitados. Usar una cuenta de demostración y evitar datos personales. La figura debe mostrar la versión que realmente se expondrá.]]

## Referencias
David, Yordy y Daylin. (2026). Librería La Crayola Gigante: código fuente y documentación del Sprint 2 [Proyecto académico no publicado]. Repositorio local.
Schwaber, K., & Sutherland, J. (2020). The Scrum Guide. https://scrumguides.org/scrum-guide.html
American Psychological Association. (s. f.). Paper format. https://apastyle.apa.org/style-grammar-guidelines/paper-format
