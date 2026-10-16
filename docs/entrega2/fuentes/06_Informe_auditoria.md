# Informe de auditoría técnica y revisión de requisitos

## Objeto de la revisión
Se revisó la versión local de Librería La Crayola Gigante para contrastar el Sprint 2 con la consigna de compras e inventario y con la ampliación de fotografías solicitada. El trabajo incluyó inspección del código, revisión de documentos, pruebas de validaciones, integración con Neon, permisos, interfaz y dependencias.

El informe describe el alcance realmente comprobado y las correcciones aplicadas. No representa una certificación independiente, una prueba de penetración exhaustiva ni una aprobación del docente. La revisión fue realizada con asistencia de una herramienta de desarrollo sobre el repositorio; el equipo debe revisar el resultado antes de presentarlo como documento final.

## Dictamen técnico
El flujo principal de proveedor, compra, detalle, recepción y entrada de inventario está implementado con una transacción. La consulta de existencias, movimientos, mínimos y alertas corresponde al alcance de recepción completa. Las fotografías se integraron al catálogo y a inventario con validación, autorización y almacenamiento compartido.

El cierre académico permanece condicionado a completar las evidencias reales de seguimiento, revisión y retrospectiva. Esta condición no se resuelve con una prueba de software: requiere participación y registro del equipo. Las limitaciones técnicas y externas se enumeran para evitar presentar un resultado más amplio que la evidencia disponible.

## Matriz de cumplimiento
| Requisito | Resultado de revisión | Evidencia principal |
|---|---|---|
| Proveedores | Implementado | Rutas de alta y edición; pantalla de proveedores |
| Compras y detalle | Implementado | Casos de compra válida, duplicados y validación |
| Recepción | Completa al registrar la compra | Registro único por compra y detalle consultable |
| Actualización automática | Implementada en transacción | Stock final y movimientos de integración |
| Inventario y movimientos | Implementado | Consulta de saldo y referencias de recepción |
| Nivel mínimo y alertas | Implementado | Caso de igualdad con mínimo y resolución |
| Cinco reglas como mínimo | Superado | Reglas originales y ampliación de fotografías |
| Cinco pruebas como mínimo | Superado | Resultados automatizados y matriz manual |
| Backlogs, historias y modelo | Documentación preparada | Documentos 01 y 02 |
| Daily, Review y Retrospective | Pendiente de evidencia real | Documento 04 con actas para completar |
| Fotografías | Implementado | Validación, consulta protegida y guardado atómico |

## Hallazgos corregidos
| ID | Prioridad | Hallazgo | Corrección aplicada | Verificación |
|---|---|---|---|---|
| A01 | Media | El catálogo no permitía fotografías | Servicio de imágenes, tabla compartida y controles de interfaz | Pruebas unitarias, integración y navegador |
| A02 | Media | El stock inicial aceptaba valores mayores al límite usado por compras y coerciones de tipo | Rango uniforme y rechazo de booleanos/entradas no numéricas | Caso 16 y validaciones adicionales |
| A03 | Media | La carga de archivos necesitaba validación real y persistencia consistente | Decodificación, límites, normalización WebP y transacción con producto | Casos de archivo inválido y edición sin pérdida |
| A04 | Media | La imagen podía quedar desactualizada en otra sesión | Fecha de modificación en consultas y recarga al cambiar la versión | Revisión del contrato y pruebas de navegador |
| A05 | Baja | El acceso seguía identificado como Sprint 1 | Texto vigente y estilo compartido | Compilación y revisión visual |
| A06 | Baja | Filtro de alertas vacío no explicaba el resultado | Mensaje explícito cuando no hay productos por reponer | Revisión de interfaz |
| A07 | Media | Dependencias sin uso incorporaban cinco avisos de seguridad | Retiro de ExcelJS/PDFKit sin uso y de Nodemon; desarrollo con Node --watch | Auditoría de dependencias posterior |
| A08 | Baja | Documentación mezclaba el entorno activo con instrucciones Oracle | Guía activa de Neon y notas de archivo histórico | Revisión documental |
| A09 | Baja | Faltaban documentos editables y guía de evidencias | Paquete Word con portadas, tablas, figuras y campos de revisión | Verificación estructural de archivos |
| A10 | Baja | El buscador de productos carecía de nombre accesible explícito | Etiqueta accesible Buscar productos | Prueba completa de navegador y Neon aprobada después de corregir |

## Resultados observados
{{RESULTADOS}}

## Riesgos y pendientes
| Pendiente o limitación | Impacto | Acción y responsable |
|---|---|---|
| Evidencias reales de Scrum y aceptación | La entrega documental no puede considerarse cerrada | Equipo: completar actas y anexos después de la reunión |
| Ensayo desde las tres computadoras | La prueba local de dos sesiones no acredita las redes domésticas | Yordy coordina; David y Daylin verifican sus instalaciones |
| Correo externo | El SMTP local de pruebas no acredita entrega real en Gmail | Equipo: configurar y probar cuando se incluya esta ampliación |
| Recepciones parciales y devoluciones | Fuera del alcance implementado | David: mantenerlas en Product Backlog para otro incremento |
| Paginación de catálogos e imágenes | El crecimiento del catálogo puede aumentar consultas y transferencia | Yordy: evaluar carga y paginación antes de un uso de gran escala |
| Compatibilidad Oracle de la ampliación | El motor activo probado es PostgreSQL; existe migración Oracle, sin nueva ejecución integral sobre ese respaldo | Revalidar solo si el equipo decide volver a usar Oracle |
| Bitácora, exportaciones y mantenimiento completo de roles | Funciones de incrementos posteriores, no parte del flujo obligatorio de esta consigna | Mantener alcance explícito; no presentarlas como terminadas |

## Recomendaciones de cierre
Realizar la demostración usando una factura nueva y un producto identificado. Conservar las capturas de antes y después, revisar el movimiento y completar el acta con la decisión real. Actualizar las copias de los tres integrantes, instalar dependencias y comprobar que todos consulten la misma base de Neon.

Antes de entregar los Word, completar los datos académicos de portada y revisar todas las marcas entre corchetes. Las tablas de resultados técnicos deben conservar su fecha y su alcance. Las capturas de interfaz simulada deben mantener esa identificación y las capturas reales deben indicar autor y contexto.

## Referencias
David, Yordy y Daylin. (2026). Librería La Crayola Gigante: versión revisada del Sprint 2 [Código y pruebas no publicados]. Repositorio local.
American Psychological Association. (s. f.). Paper format. https://apastyle.apa.org/style-grammar-guidelines/paper-format
