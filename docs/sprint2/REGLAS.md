# Reglas de negocio

| ID | Regla | Control |
|---|---|---|
| RN01 | Solo un usuario autenticado y con permiso puede operar cada módulo | Middleware JWT y permisos consultados en Oracle |
| RN02 | Solo proveedores y productos activos participan en compras | Consulta y bloqueo `FOR UPDATE` antes de registrar |
| RN03 | Una factura normalizada no puede repetirse para el mismo proveedor | Restricción única `(id_proveedor, factura)` |
| RN04 | Cada compra tiene entre 1 y 100 productos, sin repetidos | Backend y único `(id_compra, id_producto)` |
| RN05 | Cantidad entera positiva hasta 1 000 000; costo positivo ≤ 99 999 999.99, máximo dos decimales | Validación servidor; restricciones SQL |
| RN06 | El total se calcula con centavos y no se acepta un total enviado por el navegador | Suma del servidor; total máximo 9 999 999 999.99 |
| RN07 | Registrar compra confirma recepción completa y suma el stock automáticamente | Compra, detalle, recepción, movimientos y stock en una transacción |
| RN08 | Una compra tiene una sola recepción y un solo movimiento por producto recibido | Índices únicos y clave única de operación |
| RN09 | Dos compras concurrentes deben preservar ambas entradas | Bloqueos de productos en orden ascendente; suma dentro de transacción |
| RN10 | Editar datos del producto no altera el stock | Se ignora stock en UPDATE; interfaz lo muestra deshabilitado al editar |
| RN11 | El mínimo es entero no negativo; alertar si stock ≤ mínimo y producto activo | Configuración por permiso; alerta calculada con saldo actual |
| RN12 | Nombres y apellidos personales no contienen números | Letras Unicode, tildes, espacios simples, guiones y apóstrofes; validación frontend/backend |
| RN13 | El nombre comercial de proveedor sí puede contener números | No confundir una empresa con el nombre de una persona |
| RN14 | El correo de una cuenta no puede pertenecer a otra cuenta, activa o inactiva | Normalización trim/minúsculas e índice único funcional en usuarios |
| RN15 | Un correo repetido de cliente tampoco se reutiliza para otro cliente | Índice único independiente en clientes; clientes no son cuentas de acceso |
| RN16 | Notificar por correo altas y ediciones; avisar al titular ante reutilización rechazada | Cola transaccional; aviso de duplicado limitado a uno por hora en uso normal |
| RN17 | Los fallos SMTP no se presentan como envíos exitosos | PENDIENTE/ENVIADO, hasta cinco intentos; error técnico sin credenciales |
| RN18 | Todos trabajan sobre el mismo Oracle a través del mismo backend | Configuración del servidor; listados actualizados cada cinco segundos |

## NIT y CUI

No se impone «todos los NIT tienen exactamente 13 números». La documentación técnica de la SAT admite el formato tradicional con dígito final numérico o K; también existe el identificador CUI de 13 dígitos. Por ello el formulario acepta NIT tradicional con o sin guion y el identificador numérico de 13 dígitos. Normaliza mayúsculas y elimina el guion para guardar. NIT opcional en clientes; obligatorio en proveedores.

La validación implementada es de **formato**, no acredita inscripción ante SAT, existencia del documento ni propiedad del correo. No hay consulta a RTU ni validación tributaria oficial en este proyecto. Un formato correcto no garantiza que el identificador sea real.

Fuentes oficiales consultadas: [especificación técnica FEL de SAT](https://portal.sat.gob.gt/portal/descarga/6524/factura-electronica-fel/25559/gt-documento-0-1-0.pdf) y [consulta CUI/NIT de SAT](https://en.portal.sat.gob.gt/portal/preguntas-frecuentes/informacion-de-contribuyentes/). La segunda distingue la búsqueda con CUI del NIT. Reconfirmar requisitos fiscales con SAT antes de usar el proyecto para facturación real.

## Decisiones de alcance

- Recepción total al registrar compra; no hay una segunda acción que vuelva a incrementar existencias.
- Saldo inicial se registra como APERTURA. Los productos existentes reciben su movimiento de apertura durante la migración; los nuevos, al crearse.
- Un reintento con la misma clave devuelve 409 y no repite la entrada. Si hubo interrupción de red, consultar el historial antes de ingresar nuevamente la factura.
- Las cuentas antiguas pueden tener correo nulo hasta ser actualizadas. Todas las altas/ediciones nuevas requieren uno válido.
- Notificaciones por SMTP no son un sistema de verificación de identidad. La entrega en bandeja depende del proveedor y sus filtros.
