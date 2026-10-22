# Informe integrado del Sprint 3

El documento final está en `docs/Sprint_3_Analisis_de_Sistemas.docx`. Se elaboró tomando la estructura y los datos institucionales del informe del Sprint 2.

`generar_informe_sprint3.py` construye el informe usando `base_documental.json`, los diagramas, las capturas y el resultado de conciliación. Requiere python-docx, instalado localmente en `.tools/docgen`. **Regenerar sobrescribe el Word final**, por lo que primero debe respaldarse cualquier edición manual del equipo.

`revisar_informe.ps1` abre únicamente el informe generado en una instancia de Word oculta, actualiza su índice y guarda vistas de revisión en `.tools/revision-informe-sprint3`.

Desde `backend`, `node scripts/capturarEntrega3.js` verifica los datos cargados y captura la interfaz conectada a PostgreSQL. Utiliza sesiones temporales; no guarda tokens ni contraseñas en la documentación. Las imágenes de interfaz corresponden a datos de demostración y no a reuniones.

El generador se conserva fuera de `docs` para separar herramientas y documentos de entrega.
