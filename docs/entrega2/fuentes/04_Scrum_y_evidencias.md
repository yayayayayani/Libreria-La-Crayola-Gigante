# Seguimiento del Sprint y actas de trabajo

## Estado del registro
Este documento organiza la reunión prevista para la noche del 16 de octubre de 2026, hora de Guatemala, y las evidencias que todavía deben incorporarse. La hora exacta, la plataforma, la asistencia y las decisiones se completan durante la sesión. El equipo indicó que no celebró reuniones Daily anteriores; por ello no se registran fechas ni intervenciones ficticias.

El avance técnico puede reconstruirse a partir de archivos y resultados de pruebas. Esa reconstrucción explica qué está disponible, pero no equivale a una reunión diaria. La diferencia permite presentar un informe útil sin atribuir acuerdos que nadie ha confirmado.

## Distribución de la sesión de cierre
David presenta proveedores y compras; Yordy muestra inventario, movimientos y resultados de pruebas; Daylin presenta fotografías, interfaz y documentación. Yordy controla el tiempo y Daylin registra las decisiones. David verifica que cada observación termine con un responsable o una decisión explícita.

| Bloque propuesto | Duración orientativa | Conduce | Resultado esperado |
|---|---|---|---|
| Seguimiento del objetivo y pendientes | 15 minutos | Yordy | Plan concreto para terminar la entrega |
| Demostración y revisión del incremento | 30 minutos | David | Historias aceptadas o pendientes con motivo |
| Retrospectiva del trabajo | 20 minutos | Daylin | Dos mejoras realizables con responsable |
| Revisión de documentos y capturas | 15 minutos | Equipo | Evidencias organizadas y pendientes visibles |

La Guía Scrum describe el Daily como un evento breve de los desarrolladores para inspeccionar el avance y ajustar el plan (Schwaber & Sutherland, 2020). La sesión de cierre propuesta incluye actividades distintas y no reemplaza retrospectivamente los Daily que no se celebraron.

## Reconstrucción del avance disponible
El siguiente registro se basa en el repositorio revisado. Los responsables representan a quién le corresponde explicar y verificar cada bloque durante el cierre, no quién necesariamente escribió cada línea de código.

| Bloque técnico | Avance observable | Evidencia verificable | Responsable de revisión |
|---|---|---|---|
| Abastecimiento | API y pantalla de proveedores y compras | sprint2Routes.js y ComprasInventario.jsx | David |
| Integridad de inventario | Transacción, recepción y movimientos | Casos backend 01 a 07 | Yordy |
| Base compartida | Guía y esquema PostgreSQL | NEON.md y 003_postgres.sql | Yordy |
| Catálogo visual | Fotografías y presentación renovada | Productos.jsx, theme.css y servicio de imágenes | Daylin |
| Documentación | Backlogs, reglas y pruebas | Documentos editables de esta carpeta | Daylin |

## Acta de seguimiento para la reunión real
Fecha real: [completar]. Hora de inicio y final: [completar]. Plataforma o lugar: [completar]. Participantes presentes: [completar]. Objetivo inmediato: comprobar el incremento y acordar qué falta antes de entregar.

| Integrante | Avance que demuestra | Siguiente acción acordada | Impedimento real | Evidencia o referencia |
|---|---|---|---|---|
| David | [Completar con lo que muestre] | [Completar durante la reunión] | [Ninguno o descripción] | [Archivo, captura o caso] |
| Yordy | [Completar con lo que muestre] | [Completar durante la reunión] | [Ninguno o descripción] | [Archivo, captura o caso] |
| Daylin | [Completar con lo que muestre] | [Completar durante la reunión] | [Ninguno o descripción] | [Archivo, captura o caso] |

Acuerdos: [registrar decisiones concretas]. Tareas pendientes: [identificador y responsable]. Próximo seguimiento: [fecha y hora acordadas]. Elaboró el acta: [nombre]. Revisaron: [nombres].

[[CAPTURA:R01|Reunión real de seguimiento|Pegar aquí una captura tomada durante la sesión, con los tres participantes identificables y el tablero o documento compartido. Anotar fecha, hora y plataforma. La captura acredita esa sesión, no reuniones anteriores.]]

## Ejemplo de redacción, no evidencia
El texto siguiente sirve únicamente como modelo para escribir con claridad: “Se revisó la diferencia entre registrar una compra y confirmar su recepción. Como el alcance contempla recepción completa, el equipo acordó explicar esa condición antes de la demostración”. Solo puede incorporarse al acta real si la conversación y el acuerdo ocurrieron. En caso contrario, reemplazarlo por lo discutido.

Una intervención útil comunica un resultado concreto y una acción siguiente. Por ejemplo, David puede demostrar el rechazo de una factura repetida; Yordy puede comparar los saldos antes y después; Daylin puede comprobar la misma fotografía desde otra sesión. Estos son temas propuestos para discutir, no declaraciones atribuidas a los integrantes.

## Sprint Review: guion de demostración
La revisión debe mostrar una secuencia reconocible para el usuario. Primero se presenta el problema que resuelve el sistema, después se realiza la operación y finalmente se comprueba su efecto. Mantener un producto de demostración y una factura única ayuda a seguir el recorrido sin mezclarlo con datos reales.

| Paso | Presenta | Qué mostrar | Qué debe comprobar el equipo |
|---|---|---|---|
| 1 | Daylin | Menú y producto con fotografía | Navegación y reconocimiento del artículo |
| 2 | David | Proveedor activo y factura nueva | Datos obligatorios completos |
| 3 | David | Compra con dos productos | Cantidades, costos y total calculado |
| 4 | David | Confirmación y detalle | Una recepción asociada a la compra |
| 5 | Yordy | Inventario y movimientos | Cada entrada explica el nuevo saldo |
| 6 | Yordy | Mínimo, alerta y reposición | Alerta al alcanzar el mínimo y resolución |
| 7 | David | Reintento de factura | Rechazo sin duplicar existencias |
| 8 | Daylin | Fotografía desde otra sesión | Imagen compartida y permiso correcto |

### Acta de aceptación
Fecha y hora real: [completar]. Participantes: [completar]. Usuario o docente que revisa: [completar; si no participa, indicarlo]. Versión del sistema presentada: [commit o fecha].

| Historia | Aceptada / pendiente / rechazada | Evidencia | Observación y corrección | Responsable y fecha |
|---|---|---|---|---|
| HU-S2-01. Proveedores | [Completar] | [Referencia] | [Completar] | David / [fecha] |
| HU-S2-02 y 03. Compra y recepción | [Completar] | [Referencia] | [Completar] | David / [fecha] |
| HU-S2-04 y 05. Inventario y movimientos | [Completar] | [Referencia] | [Completar] | Yordy / [fecha] |
| HU-S2-09. Fotografías | [Completar] | [Referencia] | [Completar] | Daylin / [fecha] |

Cambios acordados para el Product Backlog: [completar]. Conclusión de la revisión: [completar]. La aceptación del equipo y la del docente se registran por separado si suceden en momentos distintos.

[[CAPTURA:R02|Demostración durante la Sprint Review|Insertar una captura de la pantalla compartida mostrando la compra y su recepción, con participantes visibles si la plataforma lo permite. Agregar la referencia a la historia revisada y el resultado acordado.]]

## Sprint Retrospective
El objetivo de la retrospectiva es mejorar la forma de trabajar. Conviene hablar de situaciones concretas: cómo se repartieron tareas, qué hizo difícil comprobar avances y qué mecanismo evitará dejar evidencias para el final. El resultado debe ser una acción realizable, no una frase general como “comunicarnos mejor”.

Preguntas para conversar: ¿Qué práctica nos ayudó a conservar el inventario correcto? ¿En qué momento dejamos de saber qué faltaba? ¿Qué documentación pudimos mantener mientras trabajábamos? ¿Cómo registraremos el próximo seguimiento sin acumularlo al cierre?

| Tema | Observación real del equipo | Acción acordada | Responsable | Fecha de revisión |
|---|---|---|---|---|
| Coordinación | [Completar] | [Completar] | [Completar] | [Completar] |
| Calidad y pruebas | [Completar] | [Completar] | [Completar] | [Completar] |
| Evidencias y documentación | [Completar] | [Completar] | [Completar] | [Completar] |

Propuesta para valorar, todavía no aprobada: reservar un seguimiento breve en días de trabajo y registrar al terminar tres datos: avance comprobable, siguiente tarea e impedimento. Otra propuesta es exigir una captura y un caso de prueba antes de mover una historia a terminada. El equipo puede aceptar, modificar o descartar estas propuestas.

[[CAPTURA:R03|Acuerdos de la retrospectiva|Pegar una captura del tablero o documento con las mejoras realmente acordadas. Deben verse acción, responsable y fecha. Complementar con una fotografía o captura de la sesión si existe autorización de los participantes.]]

## Lista de cierre documental
Antes de entregar, completar institución, curso, docente, apellidos y fecha de portada. Sustituir los campos entre corchetes con información real. Revisar que cada figura tenga número, título y nota de procedencia. Conservar los archivos originales de evidencia y utilizar nombres que permitan localizar cada captura.

Las firmas o confirmaciones se incorporan después de la revisión de cada integrante. No pegar nombres como si fueran firmas ni marcar historias como aceptadas solo porque la prueba automatizada pasó. Las pruebas comprueban comportamiento; la aceptación registra la decisión del equipo o del usuario.

## Referencias
Schwaber, K., & Sutherland, J. (2020). The Scrum Guide. https://scrumguides.org/scrum-guide.html
David, Yordy y Daylin. (2026). Librería La Crayola Gigante: registro técnico del Sprint 2 [Documentación de proyecto no publicada]. Repositorio local.
