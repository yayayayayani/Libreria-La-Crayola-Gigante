# Manual de uso y preparación de evidencias

## Antes de empezar
El sistema está dirigido al personal autorizado de la librería. Los clientes comerciales no son usuarios que inician sesión. Ingresar con una cuenta personal permite que la compra quede asociada a quien la registró y que los permisos determinen qué acciones están disponibles.

Para iniciar una instalación ya configurada, abrir una terminal en backend y ejecutar npm start. La aplicación compilada se consulta en http://localhost:3000. Si se modifica la interfaz, ejecutar npm run build desde frontend antes de usar la versión servida por Express. En desarrollo, npm run dev del backend utiliza el modo de vigilancia de Node.js; se recomienda Node 22 o superior.

La configuración privada permanece en backend/.env. El motor activo es PostgreSQL. La actualización de fotografías requiere npm run migrate:images desde backend una sola vez por base; es seguro repetirla. Esta revisión ya preparó la tabla en la base conectada. No ejecutar las migraciones antiguas de Oracle sobre Neon.

## Entrar y navegar
Escribir nombre de usuario y contraseña, y elegir Iniciar sesión. El menú muestra solo las funciones autorizadas. Si falta un módulo, consultar con el administrador antes de interpretar la ausencia como una falla visual. La cuenta puede perder un permiso durante una sesión; el sistema vuelve a consultar permisos y ajusta la navegación.

[[FIGURA:interfaz_menu_demo.png|Menú de la versión revisada con datos de demostración]]

## Registrar un proveedor
Entrar a Compras e inventario y abrir Proveedores. Escribir nombre comercial y NIT; completar los datos de contacto cuando estén disponibles. Guardar y comprobar que el registro aparezca en la tabla. El nombre comercial puede contener números porque representa una empresa, no un nombre personal.

Para corregir datos, elegir Editar en la fila correspondiente. Desactivar un proveedor impide usarlo en nuevas compras, pero conserva su historial. El NIT se valida por formato; la aplicación no consulta un registro tributario oficial.

[[CAPTURA:E01|Proveedor registrado|Mostrar el formulario completo y el proveedor en el listado después de guardar. Usar información de demostración.]]
[[CAPTURA:E02|Proveedor desactivado|Mostrar el estado inactivo y comprobar que no aparece como proveedor seleccionable en una compra nueva.]]

## Crear o editar productos con fotografía
Entrar a Productos. Para un artículo nuevo, seleccionar Nuevo producto, escribir código y nombre, elegir categoría, indicar precio y stock inicial, y completar la descripción. Para un artículo existente, elegir Editar producto. El stock aparece deshabilitado en edición porque las compras actualizan las existencias.

En Fotografía del producto, elegir Seleccionar imagen. Se aceptan JPEG, PNG y WebP de hasta 3 MB y 16 megapíxeles. Revisar la vista previa y guardar. Una imagen seleccionada todavía no está almacenada hasta que la operación termina correctamente.

Para reemplazar la fotografía, seleccionar otro archivo y guardar. Para retirarla, elegir Quitar imagen y guardar. Cancelar el formulario no elimina la fotografía existente. El servidor optimiza la imagen a WebP, conserva su proporción y limita el lado mayor a 1000 píxeles.

Si aparece un error de archivo, revisar formato, tamaño y dimensiones. No basta con cambiar la extensión. El servidor debe poder decodificar una imagen válida. Si solo se edita el nombre o el precio y no se selecciona imagen, la fotografía actual se conserva.

[[CAPTURA:E11|Vista previa de fotografía|Mostrar el formulario de producto con la fotografía seleccionada y los datos del artículo. La captura debe tomarse antes de guardar.]]
[[CAPTURA:E12|Fotografía compartida|Mostrar el producto guardado en otra sesión autorizada. Anotar usuario de demostración, fecha y qué cambio se verificó.]]

## Registrar una compra recibida
Abrir Compras dentro de Compras e inventario. Seleccionar proveedor, escribir serie y número de factura y elegir los productos. Para cada línea, indicar cantidad entera positiva y costo unitario. Agregar otra línea si la factura incluye más productos; un mismo producto no debe repetirse en el detalle.

Verificar el total y confirmar únicamente cuando todos los productos estén físicamente recibidos. El botón confirma recepción completa y registra la compra. Después de guardar, revisar el mensaje y consultar Ver detalle. No es necesario registrar una segunda entrada de inventario.

Si se pierde la conexión después de confirmar, consultar el historial antes de registrar otra operación. Buscar la factura y comprobar su recepción. El sistema rechaza la misma factura para el mismo proveedor y no debe incrementarse el stock por repetirla.

## Consultar inventario y movimientos
En Inventario se muestran existencias, mínimos y estado. Una alerta aparece cuando un producto activo tiene stock igual o inferior al mínimo. El filtro Mostrar solo alertas ayuda a preparar una reposición. Un usuario con permiso de gestión puede modificar el mínimo; uno con permiso de consulta solo visualiza.

[[FIGURA:interfaz_inventario_demo.png|Consulta de inventario con datos de demostración]]

En Movimientos se consulta el historial. APERTURA corresponde al saldo inicial; ENTRADA_COMPRA corresponde a la recepción de una compra. Revisar cantidad, antes, después y referencia de compra/recepción para explicar un cambio. Las consultas se actualizan periódicamente; si falla la conexión, atender el aviso y volver a comprobar antes de tomar una decisión.

## Uso desde el teléfono y otras computadoras
La interfaz adapta tarjetas y formularios a pantallas pequeñas. Las tablas conservan sus columnas y permiten desplazamiento horizontal dentro de su contenedor. Para utilizarla desde otro dispositivo se necesita una dirección accesible del servidor o una instalación propia conectada a Neon; localhost siempre hace referencia al equipo donde se abre el navegador.

[[CAPTURA:E13|Vista móvil|Capturar inventario o productos en un teléfono o a 390 píxeles de ancho. Mostrar encabezado, navegación y formulario legibles.]]
[[CAPTURA:E14|Consulta desde tres equipos|Cada integrante abre la misma base y consulta la factura de demostración. Reunir las tres capturas con fecha y nombre del equipo; no incluir credenciales.]]

## Organización recomendada de archivos
Guardar las capturas reales en una carpeta evidencias_equipo con nombres como E03_compra_antes.png o R02_review_2026-10-16.png. Conservar el original y colocar una copia en Word. Debajo de cada imagen escribir qué demuestra, cuándo se obtuvo y quién la tomó. No ampliar imágenes pequeñas hasta que el texto pierda legibilidad.

Las imágenes incluidas automáticamente en este manual provienen de una prueba de interfaz con respuestas simuladas y datos de demostración. Son útiles para reconocer la versión visual, pero no reemplazan las capturas reales de la compra del equipo ni las reuniones.

## Referencias
David, Yordy y Daylin. (2026). Librería La Crayola Gigante: interfaz y guía de operación [Aplicación y documentación no publicadas]. Repositorio local.
