# Entrega 2: paquete editable

Revisión del 16 de octubre de 2026, Guatemala.

[Descargar los seis documentos Word juntos](Entrega2_Documentos_Editables.zip).

Los seis archivos fueron abiertos y paginados en Microsoft Word, con índices actualizados: 66 páginas en conjunto. Registro en `REVISION_WORD.json`. La exportación PDF de revisión se interrumpió y no forma parte de la entrega.

## Documentos Word

1. [Informe y planificación](Word/01_Informe_y_planificacion.docx): objetivo, alcance, tareas de David/Yordy/Daylin, backlogs e historias.
2. [Diseño y reglas](Word/02_Diseno_y_reglas.docx): arquitectura, flujo, modelo, diccionario y reglas.
3. [Pruebas y aceptación](Word/03_Pruebas_y_aceptacion.docx): casos, resultados y espacios de evidencia.
4. [Scrum y evidencias](Word/04_Scrum_y_evidencias.docx): sesión propuesta para esta noche, actas y retrospectiva para completar.
5. [Manual y capturas](Word/05_Manual_y_capturas.docx): operación del sistema y fotografías.
6. [Informe de auditoría](Word/06_Informe_auditoria.docx): hallazgos, correcciones, comprobaciones y límites.

Los archivos usan formato académico basado en APA 7: papel carta, márgenes de 2.54 cm, Times New Roman 12, cuerpo a doble espacio, sangría inicial, paginación y referencias con sangría francesa. Las tablas usan espaciado compacto para facilitar lectura. Se incluyeron títulos de tablas/figuras e índice automático. La portada contiene campos para institución, curso, docente y apellidos porque no fueron proporcionados.

## Antes de entregar

- Revisar nombres, fechas, datos de portada y campos entre corchetes.
- Pegar las capturas indicadas en cada espacio y explicar el resultado observado.
- Completar las actas después de las reuniones reales. Los ejemplos no son evidencia histórica.
- En Word, actualizar el índice si cambia el contenido. Revisar saltos de página después de agregar capturas.
- Conservar el alcance de cada prueba: las capturas `interfaz_*_demo.png` usan datos simulados, no son reuniones ni compras del equipo.

## Cambios del sistema

Fotografías JPEG/PNG/WebP de hasta 3 MB y 16 megapíxeles, convertidas a WebP; vista previa, reemplazo y eliminación. Las fotos se guardan junto al producto de forma transaccional, con consulta autorizada. Se comparten mediante Neon y aparecen en Productos e Inventario. La interfaz comparte una nueva identidad visual y distribución adaptable.

En backend: `npm install`, `npm run migrate:images` y `npm start`. En frontend: `npm install` y `npm run build`. La tabla de imágenes ya se preparó en la base conectada durante esta revisión. El backend en desarrollo utiliza `node --watch`; se recomienda Node 22 o superior.

## Fuentes y regeneración

Los textos están en `fuentes/`; los diagramas editables en `figuras/*.svg`; los resultados en [RESULTADOS.md](RESULTADOS.md). La regeneración sobrescribe los Word: guardar aparte cualquier versión editada manualmente antes de regenerar.

```text
# Desde backend
node scripts/generarDiagramas.js
# Desde la raíz; requiere python-docx instalado
python docs/entrega2/generar_documentos.py
```

Se instalaron las herramientas Python de esta sesión en `.tools/python`, carpeta local ignorada por Git. En otro equipo instalar `python-docx` en su entorno Python.

Formato consultado: [APA Style, Paper format](https://apastyle.apa.org/style-grammar-guidelines/paper-format). Referencia de Scrum: [The Scrum Guide](https://scrumguides.org/scrum-guide.html).
