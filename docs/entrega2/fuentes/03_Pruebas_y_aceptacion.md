# Plan de pruebas y aceptación del incremento

## Objetivo
Las pruebas comprueban que una compra válida produzca una recepción y una entrada de inventario, y que una operación inválida no deje registros parciales. También revisan permisos, duplicados, concurrencia, mínimos y fotografías. El propósito es demostrar resultados observables, no solamente que los formularios se abren.

## Entorno y alcance de la evidencia
La revisión técnica se realizó el 16 de octubre de 2026, con Node.js, Express, React, PostgreSQL en Neon y Microsoft Edge mediante Playwright. Las pruebas del navegador que interceptan respuestas de API se distinguen de la prueba completa contra Express y Neon. Los datos usados por las pruebas de integración tienen identificadores propios y se retiran al finalizar.

Las pruebas no acreditan una reunión, una firma de aceptación ni el funcionamiento desde las computadoras físicas de los tres integrantes. Esas comprobaciones se documentan por separado. La preparación de capturas no requiere mostrar contraseñas, tokens ni el archivo .env.

## Estrategia
Primero se comprueban validadores y el adaptador de base de datos. Luego se ejecuta el flujo HTTP contra Neon, incluyendo cambios de stock y fotografías. La regresión verifica que los permisos anteriores sigan funcionando. Finalmente se prueba la interfaz, incluyendo la selección de archivos y la distribución en una pantalla de teléfono.

## Casos funcionales para la demostración
Cada caso puede repetirse por el equipo con datos propios de demostración. Registrar en la última columna la fecha, el nombre de quien ejecuta y la referencia a la captura. El resultado automatizado de la revisión se encuentra en la sección de resultados; no se debe copiar como si fuera una ejecución manual del equipo.

| Caso | Precondición y pasos | Resultado esperado | Ejecución manual del equipo |
|---|---|---|---|
| CP01. Compra válida | Producto con stock 10. Comprar 3 unidades a Q2.25 y confirmar recepción | Total Q6.75; stock 13; una recepción y movimiento 10 + 3 = 13 | [Fecha, ejecutor, E03–E07] |
| CP02. Factura duplicada | Repetir proveedor y factura de CP01 | HTTP 409 o aviso equivalente; stock permanece en 13 | [Fecha, ejecutor, E05] |
| CP03. Datos inválidos | Intentar cantidad 0, negativa o fraccionaria y costo con tres decimales | Rechazo; no crear compra ni incrementar stock | [Fecha, ejecutor, evidencia] |
| CP04. Producto inactivo | Desactivar un producto y usarlo en una petición de compra | Rechazo del servidor aunque se evite la interfaz | [Fecha, ejecutor, evidencia] |
| CP05. Concurrencia | Registrar dos compras simultáneas de 3 unidades sobre el mismo producto | El saldo aumenta 6; no se pierde una entrada | [Fecha, ejecutor, evidencia] |
| CP06. Nivel mínimo | Configurar mínimo igual al stock; después recibir más unidades | Alerta activa en igualdad y resuelta al superar mínimo | [Fecha, ejecutor, E08–E09] |
| CP07. Permisos | Usar un usuario sin permisos y una petición sin token válido | 403 o 401 según corresponda; ninguna escritura | [Fecha, ejecutor, evidencia] |
| CP08. Edición con saldo antiguo | Editar catálogo enviando stock 0 después de una compra | Se conserva el saldo verdadero del inventario | [Fecha, ejecutor, evidencia] |
| CP09. Fotografía | Cargar PNG, guardar, abrir desde otra sesión y reemplazar | Imagen visible y compartida; no cambia el stock | [Fecha, ejecutor, E11–E12] |
| CP10. Archivo inválido | Intentar texto disfrazado de PNG o archivo demasiado grande | Rechazo sin edición parcial ni pérdida de foto anterior | [Fecha, ejecutor, evidencia] |
| CP11. Quitar fotografía | Editar, elegir Quitar imagen y guardar | El artículo sigue existiendo con su saldo y sin foto | [Fecha, ejecutor, evidencia] |
| CP12. Vista móvil | Abrir a 390 píxeles de ancho y recorrer inventario y formulario | Sin desbordamiento de la página; tabla desplazable | [Fecha, ejecutor, E13] |

## Resultados de la revisión automatizada
{{RESULTADOS}}

## Casos originales del Sprint
El registro siguiente conserva el detalle de la ejecución anterior y la evolución hacia Neon. Sus fechas históricas no se sustituyen por la fecha de generación de este documento. La tabla de resultados de esta revisión identifica qué se volvió a ejecutar.

{{PRUEBAS}}

## Guía de capturas funcionales
Tomar las capturas con la misma compra y el mismo producto de demostración cuando sea posible. Así se puede seguir el código del producto, la factura y los identificadores entre pantallas. Una imagen sin contexto debe acompañarse de una nota que explique qué se esperaba y qué ocurrió.

[[CAPTURA:E03|Formulario de compra antes de confirmar|Mostrar proveedor, factura, dos productos, cantidades, costos y total. No confirmar hasta haber tomado la imagen.]]
[[CAPTURA:E04|Compra recibida y detalle|Mostrar el mensaje de éxito y la consulta del detalle con el identificador de recepción. La factura debe coincidir con E03.]]
[[CAPTURA:E05|Rechazo de factura duplicada|Mostrar el aviso del reintento y añadir una captura o nota del saldo que permanece sin cambios.]]
[[CAPTURA:E06|Inventario antes de la compra|Mostrar código, nombre y stock del producto antes de confirmar la recepción. Anotar la cantidad que se recibirá.]]
[[CAPTURA:E07|Inventario después de la compra|Mostrar el mismo producto con el saldo actualizado. Explicar la operación: saldo anterior + entrada = saldo nuevo.]]
[[CAPTURA:E08|Alerta de reposición|Configurar el mínimo igual o superior al stock y mostrar el producto marcado como Reponer.]]
[[CAPTURA:E09|Alerta resuelta|Después de una compra que supere el mínimo, mostrar el producto Disponible.]]
[[CAPTURA:E10|Movimiento de inventario|Mostrar cantidad, saldo anterior, saldo nuevo y referencia de compra/recepción de la misma operación.]]

## Criterio de aprobación y registro de defectos
Un caso aprueba si el resultado coincide con lo esperado y no deja efectos secundarios incompatibles. Un mensaje de éxito sin el movimiento correspondiente es un fallo, aunque el formulario se cierre. Ante un defecto, registrar los pasos exactos, el usuario y sus permisos, los datos de prueba y el resultado observado.

| Defecto | Pasos para repetir | Esperado / observado | Responsable | Estado y evidencia de corrección |
|---|---|---|---|---|
| [ID] | [Completar] | [Completar] | [Completar] | [Completar] |

## Referencias
David, Yordy y Daylin. (2026). Casos automatizados de compras, permisos e imágenes [Software de prueba no publicado]. Repositorio local, backend/tests y frontend/tests.
