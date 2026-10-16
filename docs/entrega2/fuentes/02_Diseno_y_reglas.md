# Diseño del sistema, modelo de datos y reglas de negocio

## Propósito del diseño
El diseño conecta la operación comercial con los registros que permiten comprobarla. La interfaz recoge una factura y sus líneas; el servidor valida el contenido, consulta permisos y coordina los cambios; la base mantiene relaciones y restricciones. La separación permite que una validación visual ayude al usuario sin convertirse en la única protección de los datos.

## Arquitectura
React presenta los formularios y las consultas. Express recibe peticiones JSON, verifica el token y consulta los permisos vigentes. PostgreSQL en Neon almacena la información compartida. Cada integrante puede ejecutar el backend en su computadora y utilizar la misma base; por esa razón, las fotografías también se conservan en Neon y no en una carpeta exclusiva de una laptop.

Las consultas periódicas actualizan los listados. El servidor no mantiene una transmisión continua de inventario: el navegador vuelve a consultar. Una falta de conexión puede retrasar la vista, aunque la operación de otro usuario ya se haya confirmado en la base.

[[FIGURA:arquitectura.png|Arquitectura de la aplicación y almacenamiento compartido]]

## Flujo de compra y recepción
El encargado selecciona un proveedor activo, introduce la factura y añade productos con cantidad y costo. Antes de confirmar, comprueba que los artículos ya fueron recibidos. El servidor calcula el total en centavos y valida que no existan productos repetidos en el detalle.

Después se bloquean el proveedor y los productos involucrados. Los productos se ordenan por identificador antes de bloquearlos para reducir conflictos entre compras concurrentes. La operación inserta compra, detalles y recepción, suma el stock y registra un movimiento por producto. Si alguna instrucción falla, se revierte el conjunto.

[[FIGURA:flujo.png|Flujo transaccional de registro de compra]]

## Relaciones del modelo
Un proveedor puede abastecer varias compras. Cada compra incluye al menos un detalle en el flujo de la aplicación y una recepción completa. El detalle referencia al producto; el movimiento explica la cantidad que ingresó y conserva la recepción que lo originó. Una apertura de inventario puede existir sin compra ni recepción porque representa un saldo inicial.

[[FIGURA:modelo.png|Relaciones principales de compras, inventario y fotografías]]

{{MODELO}}

## Ampliación para imágenes
La tabla IMAGENES_PRODUCTOS tiene una relación de cero o una imagen por producto. ID_PRODUCTO es clave primaria y foránea. CONTENIDO almacena la imagen WebP codificada en base64; ACTUALIZADO_EN conserva el momento del registro. La eliminación del producto elimina su imagen asociada mediante la clave foránea, aunque la operación habitual del sistema es desactivar productos.

El cliente envía una imagen opcional durante el alta o la edición. Omitir el campo conserva la fotografía; enviar null solicita quitarla. El servidor decodifica y vuelve a generar el archivo, limita dimensiones y no conserva los metadatos del original. No se aceptan SVG, enlaces externos ni archivos que solo cambian de extensión para aparentar una imagen.

| Elemento | Contrato |
|---|---|
| Entrada | Campo imagen con data URL PNG, JPEG o WebP; null elimina; ausencia conserva |
| Tamaño máximo de entrada | 3 MB de archivo y 16 millones de píxeles |
| Salida normalizada | WebP; lado máximo de 1000 píxeles; conserva proporción |
| Lectura | GET /api/productos/:id/imagen con token y permiso |
| Sin fotografía | HTTP 204 y representación visual de producto sin foto |
| Error de archivo | HTTP 400; no guardar cambios parciales del producto |
| Migración | npm run migrate:images; ampliación aditiva e idempotente |

## Reglas de negocio
Las reglas siguientes expresan restricciones observables. Las validaciones del servidor y las restricciones de base se complementan: el navegador orienta la entrada, pero una petición directa a la API debe cumplir las mismas condiciones.

{{REGLAS}}

| ID adicional | Regla | Evidencia de cumplimiento |
|---|---|---|
| RN19 | El stock inicial pertenece al rango de 0 a 9999999999 y no acepta booleanos | Caso de integración 16 |
| RN20 | Las fotografías deben ser imágenes compatibles y respetar tamaño y dimensiones | Pruebas unitarias de imágenes |
| RN21 | Una imagen inválida no permite guardar una edición parcial | Caso de integración 15 |
| RN22 | La lectura de fotografías requiere autorización | Caso de integración 14 |

## Integridad, concurrencia y trazabilidad
La clave de operación y la combinación proveedor–factura previenen duplicados. La clave no sustituye la factura: ambas protecciones cubren reintentos y registros comerciales repetidos. Las cantidades se suman dentro de la transacción, evitando que una pantalla con datos antiguos reemplace el saldo actual.

La edición del catálogo modifica código, nombre, categoría, descripción, precio y fotografía. El saldo existente no se reemplaza con el valor enviado por el formulario. De este modo, una compra registrada por otra persona mientras se edita el producto conserva su efecto.

## Límites del diseño actual
El incremento no implementa recepción parcial, devolución, reserva de stock ni salida por venta. Tampoco representa una certificación tributaria del NIT. Las fotografías están pensadas para un catálogo académico o pequeño; para un catálogo masivo se debe evaluar almacenamiento de objetos, paginación y carga diferida más amplia.

[[CAPTURA:D01|Modelo físico de la base|Insertar una captura del diagrama en DBeaver o de las tablas con claves. Ocultar cadenas de conexión y credenciales. Comprobar que aparezca IMAGENES_PRODUCTOS.]]

## Referencias
David, Yordy y Daylin. (2026). Librería La Crayola Gigante: esquema PostgreSQL y rutas de compras [Código fuente no publicado]. Repositorio local, database y backend/src.
