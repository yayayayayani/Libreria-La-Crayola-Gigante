# Diagramas y modelo de datos

## Flujo de negocio

```mermaid
flowchart TD
 A[Seleccionar proveedor activo] --> B[Ingresar factura]
 B --> C[Agregar productos, cantidades y costos]
 C --> D[Confirmar recepción completa]
 D --> E{Validaciones y permisos}
 E -->|Inválidos| F[Mostrar error sin modificar inventario]
 E -->|Válidos| G[Bloquear proveedor y productos]
 G --> H[Guardar compra y detalles]
 H --> I[Guardar recepción y movimientos]
 I --> J[Sumar existencias]
 J --> K{Operación completa}
 K -->|Sí| L[COMMIT y mostrar confirmación]
 K -->|No| M[ROLLBACK de toda la compra]
 L --> N[Actualizar listados y alertas]
```

## Secuencia de compra

```mermaid
sequenceDiagram
 actor U as Encargado
 participant UI as React
 participant API as Express
 participant DB as PostgreSQL en Neon
 U->>UI: Confirmar recepción y registrar
 UI->>API: POST /api/compras + JWT + clave
 API->>DB: Consultar identidad y permisos
 API->>API: Validar detalle y calcular total
 API->>DB: SELECT proveedor/productos FOR UPDATE
 API->>DB: INSERT compra, detalle y recepción
 API->>DB: UPDATE stock e INSERT movimientos
 alt Éxito
 API->>DB: COMMIT
 API-->>UI: 201, ID y total
 else Error o duplicado
 API->>DB: ROLLBACK
 API-->>UI: 400 / 409 / 500
 end
 UI->>API: Consultas cada 5 s y al recuperar foco
```

## Modelo entidad-relación

```mermaid
erDiagram
 ROLES ||--o{ USUARIOS : asigna
 ROLES ||--o{ ROL_PERMISO : posee
 PERMISOS ||--o{ ROL_PERMISO : autoriza
 PROVEEDORES ||--o{ COMPRAS : abastece
 USUARIOS ||--o{ COMPRAS : registra
 COMPRAS ||--|{ DETALLE_COMPRAS : contiene
 PRODUCTOS ||--o{ DETALLE_COMPRAS : comprado
 COMPRAS ||--|| RECEPCIONES : confirma
 USUARIOS ||--o{ RECEPCIONES : recibe
 RECEPCIONES |o--|{ MOVIMIENTOS_INVENTARIO : origina
 PRODUCTOS ||--o{ MOVIMIENTOS_INVENTARIO : afecta
 USUARIOS |o--o{ MOVIMIENTOS_INVENTARIO : registra
 CATEGORIAS ||--o{ PRODUCTOS : agrupa
 PRODUCTOS ||--o| IMAGENES_PRODUCTOS : fotografia
```

La recepción es obligatoria en el flujo de la aplicación y se crea en la misma transacción. La FK y el índice SQL garantizan como máximo una por compra. Un movimiento APERTURA puede no tener recepción o usuario. `CORREOS_PENDIENTES` guarda una copia de la dirección destinataria para conservar el destino del evento, sin FK a usuarios. `CLIENTES` permanece independiente del proceso de abastecimiento.

## Diccionario del incremento

| Tabla | Campos principales | Relaciones y restricciones |
|---|---|---|
| PROVEEDORES | ID_PROVEEDOR, NOMBRE, NIT, CORREO, TELEFONO, DIRECCION, ESTADO | PK identity; NIT único; estado A/I |
| COMPRAS | ID_COMPRA, ID_PROVEEDOR, ID_USUARIO, FACTURA, CLAVE, TOTAL, ESTADO, FECHA | Proveedor/usuario FK; factura única por proveedor; clave única; estado RECIBIDA |
| DETALLE_COMPRAS | ID_DETALLE, ID_COMPRA, ID_PRODUCTO, CANTIDAD, COSTO | FKs compra/producto; producto único por compra |
| RECEPCIONES | ID_RECEPCION, ID_COMPRA, ID_USUARIO, FECHA | Compra única y FKs compra/usuario |
| MOVIMIENTOS_INVENTARIO | ID_MOVIMIENTO, ID_PRODUCTO, ID_RECEPCION, ID_USUARIO, TIPO, CANTIDAD, STOCK_ANTERIOR, STOCK_NUEVO, FECHA | Nuevo = anterior + cantidad; tipos APERTURA/ENTRADA_COMPRA; único recepción/producto |
| IMAGENES_PRODUCTOS | ID_PRODUCTO PK/FK, CONTENIDO TEXT, ACTUALIZADO_EN TIMESTAMP | Cero o una imagen WebP por producto; eliminación en cascada |
| PRODUCTOS (ampliación) | STOCK_MINIMO BIGINT DEFAULT 0 | ≥ 0; STOCK existente sigue siendo saldo actual |
| USUARIOS (ampliación) | CORREO VARCHAR(120) | Índice único LOWER(TRIM(CORREO)); permite nulos históricos |
| CLIENTES (ampliación) | Índice sobre CORREO existente | Único LOWER(TRIM(CORREO)) |
| CORREOS_PENDIENTES | ID_CORREO, DESTINATARIO, ASUNTO, MENSAJE, ESTADO, INTENTOS, CREADO_EN, ENVIADO_EN, ULTIMO_ERROR | Estados PENDIENTE/ENVIADO; no guarda contraseñas SMTP |
| MIGRACIONES | NOMBRE, APLICADO_EN | Evita reaplicar el incremento |

El SQL con tipos completos está en `database/003_postgres.sql` (motor activo); `database/002_sprint2.sql` conserva el incremento histórico Oracle. Los saldos no se duplican en otra tabla INVENTARIO: el inventario se consulta desde PRODUCTOS y su historial se conserva en MOVIMIENTOS_INVENTARIO.

## Arquitectura compartida

```mermaid
flowchart LR
 A[Navegador David] --> D[Backend laptop David]
 B[Navegador Yordy] --> Y[Backend laptop Yordy]
 C[Navegador Daylin] --> L[Backend laptop Daylin]
 D --> O[(PostgreSQL compartido en Neon)]
 Y --> O
 L --> O
 O --> W[Worker de correos del backend habilitado]
 W --> M[Gmail SMTP]
```

Cada equipo usa la misma base y rama de Neon. Las pantallas consultan cambios cada cinco segundos; Neon no aloja el backend. El envío necesita al menos un backend encendido con SMTP habilitado. Los workers coordinan la cola con FOR UPDATE SKIP LOCKED.
