# Auditoría de roles y permisos — Librería La Crayola Gigante

Fecha: 9 de octubre de 2026 (America/Guatemala).

## Resultado y alcance

Se revisaron todas las rutas, controladores, middlewares y pantallas existentes. Se corrigieron controles de autorización y se ejecutaron **187 casos de integración HTTP + JWT + Oracle**, todos aprobados, además de **13 casos de navegador**, todos aprobados. Compilación y lint de React aprobados, sin advertencias de lint.

Esto no significa que los diez módulos estén completos: `BITACORA_VER` y `REPORTES_EXPORTAR` existen en el catálogo de Oracle, pero no tienen rutas, controladores ni pantallas. `ROLES_GESTIONAR` permite consultar roles y gestionar sus asignaciones; faltan las operaciones de creación/edición/activación de roles.

Los cambios de trabajo que ya existían se conservaron. No se cambió el diseño, las tecnologías ni el esquema Oracle.

## Hallazgos y correcciones

1. **Escalamiento mediante cuentas secundarias:** un gestor de usuarios podía crear una cuenta Administrador, promover otra cuenta o modificar/desactivar cuentas administrativas. Nuevo middleware `protegerUsuarios`: un gestor que no pertenezca al rol 1 solo puede crear y modificar cuentas de su mismo rol. El Administrador conserva la administración de otros roles. Los UPDATE también comprueban el rol del registro para evitar que una promoción concurrente eluda el control previo.
2. **Campos administrativos y autoservicio:** se rechazan con 403 los campos ajenos a cada operación (incluidos permisos/estado inyectados en creación o edición), cambios del propio rol y cambios del propio estado. El nombre propio puede editarse conservando el rol.
3. **JWT:** verificación explícita HS256, ID entero positivo y expiración obligatoria; `NotBeforeError` devuelve 401. Los permisos y el rol del JWT no otorgan autoridad: se usan el usuario, rol y asignaciones actuales de Oracle.
4. **Acciones visibles para usuarios de consulta:** los botones Crear, Editar, Activar y Desactivar de clientes y productos dependen de su permiso específico. El formulario abierto deja de mostrarse al perder el permiso correspondiente. Crear categorías requiere `PRODUCTOS_CREAR`.
5. **Permisos React obsoletos:** actualización cada 15 segundos, al recuperar foco, después de guardar asignaciones y al recibir 401/403. La identidad y el rol mostrado también se refrescan. Ante fallo de la consulta se vacían permisos y se retira la pantalla protegida. Las peticiones tienen timeout de 10 segundos y `/auth/permisos` responde `Cache-Control: no-store`.
6. **Roles codificados en el formulario de usuarios:** se reemplazaron las opciones fijas por `/usuarios/roles-asignables`, protegido con `USUARIOS_GESTIONAR`, que devuelve los roles activos asignables por el actor. El propio rol/estado no se puede cambiar desde la pantalla.
7. **Diferencia entre interfaz y protección administrativa:** la pantalla de permisos deja editar únicamente al Administrador; identifica el rol protegido por ID 1, igual que el backend, y no habilita guardar si falló la carga. Se mantiene la regla administrativa preexistente: incluso con `ROLES_GESTIONAR`, otro rol solo consulta; no modifica asignaciones.
8. **Permiso de creación sin consulta:** se permite abrir el módulo y crear sin cargar su listado. El catálogo de categorías admite cualquiera de los permisos de productos para permitir seleccionar una categoría al crear/editar, sin conceder consulta de productos.
9. **Cambios simultáneos de asignaciones:** se bloquea la fila del rol con `FOR UPDATE` antes de reemplazar sus permisos dentro de la transacción existente. No se realizó una prueba de carga/concurrencia.
10. **Pruebas reproducibles:** el servidor se puede importar sin abrir automáticamente un puerto; se agregaron auditoría Oracle de solo lectura, integración transaccional y pruebas de interfaz. Se añadió `JWT_SECRET` a `.env.example`, sin publicar el secreto real.

Ya estaban correctamente implementados la consulta del estado de usuario/rol por petición, la consulta de `ROL_PERMISO`, los permisos de las rutas CRUD de clientes/productos, el hash bcrypt y los parámetros enlazados en SQL. No se atribuyen como correcciones nuevas.

## Matriz de los diez permisos

Resultados de integración real. `200/201` indica operación autorizada; `401` autenticación rechazada; `403` autorización rechazada. “Claims” prueba que declarar rol Administrador y permisos dentro de un JWT no sustituye las asignaciones reales.

| Permiso | Implementación | Con permiso | Sin permiso | Sin token | Inválido / expirado | Usuario / rol inactivo | Revocar y conceder, mismo JWT | Claims de privilegios | Casos por rutas |
|---|---|---|---|---|---|---|---|---|---|
| USUARIOS_GESTIONAR | Consulta, creación, edición, estado y catálogo asignable | 200/201¹ | 403 | 401 | 401 / 401 | 403 / 403 | Aprobado¹ | 403 | 45 |
| ROLES_GESTIONAR | Consulta y asignaciones; CRUD de roles incompleto | 200¹ | 403 | 401 | 401 / 401 | 403 / 403 | Aprobado¹ | 403 | 36 |
| CLIENTES_VER | Consulta | 200 | 403 | 401 | 401 / 401 | 403 / 403 | Aprobado | 403 | 9 |
| CLIENTES_CREAR | Creación | 201 | 403 | 401 | 401 / 401 | 403 / 403 | Aprobado | 403 | 9 |
| CLIENTES_EDITAR | Edición y estado | 200 | 403 | 401 | 401 / 401 | 403 / 403 | Aprobado | 403 | 18 |
| PRODUCTOS_VER | Consulta de productos y categorías | 200 | 403² | 401 | 401 / 401 | 403 / 403 | Aprobado | 403 | 18 |
| PRODUCTOS_CREAR | Creación de productos y categorías | 201 | 403 | 401 | 401 / 401 | 403 / 403 | Aprobado | 403 | 18 |
| PRODUCTOS_EDITAR | Edición y estado | 200 | 403 | 401 | 401 / 401 | 403 / 403 | Aprobado | 403 | 18 |
| BITACORA_VER | **No implementado** | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | 0 |
| REPORTES_EXPORTAR | **No implementado** | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | 0 |

¹ Además del permiso se aplican las restricciones administrativas descritas. La actualización de asignaciones y el cambio de estado de otro usuario se probaron autorizados con la cuenta Administrador temporal. Su denegación se probó con el rol temporal sin autorización; no se retiraron permisos al Administrador existente.

² Para categorías, la denegación corresponde a no tener ninguno de `PRODUCTOS_VER`, `PRODUCTOS_CREAR` y `PRODUCTOS_EDITAR`. Tener crear/editar permite consultar categorías, pero no listar productos.

Son **171 casos sobre 19 rutas/operaciones**, más **16 casos transversales**: combinación de consulta, escalamiento por creación/promoción/estado/campos, protección del administrador, cambio de rol con el mismo token, variantes JWT, login válido/incorrecto/inactivo, refresco de sesión, revocación por API, creación sin consulta, activación y comprobación SQL de escrituras.

Para clientes/productos, las pruebas con permiso de consulta exclusivamente rechazan todas las escrituras y operaciones administrativas con 403. Las pruebas de escalamiento de usuarios/roles rechazan las acciones con 403. Las rutas ausentes de bitácora/reportes no se contabilizan como autorizaciones probadas.

## Inventario de endpoints

Todos los siguientes, salvo login, exigen JWT y usuario/rol activos.

| Método y ruta (prefijo `/api`) | Regla |
|---|---|
| POST `/auth/login` | Credenciales bcrypt y estados activos |
| GET `/auth/permisos` | Sesión autenticada; devuelve permisos propios actuales |
| GET `/usuarios`, GET `/usuarios/roles-asignables` | USUARIOS_GESTIONAR |
| POST `/usuarios`, PUT `/usuarios/:id`, PATCH `/usuarios/:id/estado` | USUARIOS_GESTIONAR + protección administrativa |
| GET `/roles`, GET `/roles/permisos`, GET `/roles/:id/permisos` | ROLES_GESTIONAR |
| PUT `/roles/:id/permisos` | ROLES_GESTIONAR + rol 1; rol destino 1 protegido |
| GET `/clientes` | CLIENTES_VER |
| POST `/clientes` | CLIENTES_CREAR |
| PUT `/clientes/:id`, PATCH `/clientes/:id/estado` | CLIENTES_EDITAR |
| GET `/productos` | PRODUCTOS_VER |
| POST `/productos` | PRODUCTOS_CREAR |
| PUT `/productos/:id`, PATCH `/productos/:id/estado` | PRODUCTOS_EDITAR |
| GET `/categorias` | Alguno de PRODUCTOS_VER / CREAR / EDITAR |
| POST `/categorias` | PRODUCTOS_CREAR |

GET `/api` es información pública del servidor; no devuelve registros de negocio. No hay rutas de exportación ni de bitácora.

## Oracle comprobado

- `USUARIOS.ID_ROL → ROLES.ID_ROL`: FK habilitada.
- `ROL_PERMISO.ID_ROL → ROLES.ID_ROL` y `ROL_PERMISO.ID_PERMISO → PERMISOS.ID_PERMISO`: FK habilitadas.
- PK compuesta de `ROL_PERMISO` y unicidad de `PERMISOS.CODIGO` habilitadas.
- Cero usuarios/asignaciones huérfanos y cero pares duplicados.
- Rol 1 Administrador activo: diez permisos; rol 2 Empleado activo: `CLIENTES_VER`, `PRODUCTOS_VER`.
- Una cuenta activa por cada uno de estos roles, tanto antes como después de las pruebas.

Las pruebas crearon **registros temporales**, consultaron y modificaron únicamente sus fixtures y ejecutaron ROLLBACK. No hubo DDL ni cambios confirmados en registros existentes. Las secuencias/identidades Oracle pueden avanzar aunque se reviertan las inserciones; no se intentó reajustarlas.

**Límite de integración:** el harness usa SQL real y peticiones HTTP reales, pero proporciona a los controladores una sola conexión transaccional y suprime `autoCommit`, `commit`, `rollback` y `close` de los controladores. El harness gestiona sus propios SAVEPOINT/ROLLBACK. No se probó la persistencia tras COMMIT ni el aislamiento entre conexiones concurrentes. No hubo navegador conectado a Oracle de extremo a extremo: las pruebas de navegador simulan las respuestas HTTP y la suite backend prueba Oracle separadamente.

## Ejecuciones y resultados

- `backend`: `npm.cmd run test:permissions` → **187/187**, cero fallos, ROLLBACK final ejecutado.
- `backend`: `npm.cmd run audit:oracle` → consultas completadas; auditoría posterior confirmó las cuentas existentes y ausencia de huérfanos/duplicados.
- `frontend`: `npm.cmd run test:permissions` → **12/12**; después se agregó y ejecutó `-- --grep "nuevo permiso"` → **1/1**. Total: **13 escenarios distintos aprobados**.
- `frontend`: `npm.cmd run lint` → aprobado, sin advertencias.
- `frontend`: `npm.cmd run build` → aprobado.

La primera ejecución de integración encontró dos errores del adaptador de pruebas (binds indefinidos); se corrigió el adaptador y se volvió a ejecutar la suite. La primera ejecución de navegador completó sus casos pero quedó bloqueada al cerrar procesos en el sandbox; se interrumpió y la ejecución posterior fuera del sandbox terminó con código 0. Los resultados anteriores corresponden a ejecuciones terminadas correctamente.

Los 13 escenarios de interfaz cubren menú y acciones de solo consulta, crear sin consultar en ambos módulos, editar sin crear y revocar formularios abiertos, mensaje 403, revocación periódica de pantalla administrativa, rol inactivo, concesión al recuperar foco, navegación a URL administrativa, edición de asignaciones según rol y protección del rol/estado propio.

## Archivos modificados o agregados en esta auditoría

- `.gitignore`, `AUDITORIA_PERMISOS.md`.
- `backend/.env.example`, `backend/package.json`, `backend/src/server.js`.
- `backend/src/middlewares/authMiddleware.js`, `permisosMiddleware.js`, **`usuariosSeguridad.js` (nuevo)**.
- `backend/src/controllers/usuariosController.js`, `rolesController.js`.
- `backend/src/routes/authRoutes.js`, `usuariosRoutes.js`, `categoriasRoutes.js`.
- **`backend/scripts/auditarOracle.js` y `probarPermisos.js` (nuevos)**.
- `frontend/package.json`, `frontend/package-lock.json` (Playwright como dependencia de desarrollo).
- `frontend/src/App.jsx`, `frontend/src/services/api.js`.
- `frontend/src/pages/Clientes.jsx`, `Productos.jsx`, `Usuarios.jsx`, `RolesPermisos.jsx`, `Dashboard.jsx`.
- **`frontend/playwright.config.js`, `frontend/tests/permisos.spec.js` (nuevos)**.

No se modificaron los estilos durante esta auditoría. Algunos archivos anteriores ya estaban modificados o sin seguimiento al comenzar; se preservaron esas funcionalidades.

## Reproducción y verificación manual

1. En `backend/.env`, configurar `DB_USER`, `DB_PASSWORD`, `DB_CONNECT_STRING` y un `JWT_SECRET` aleatorio. En el entorno de frontend, configurar `VITE_API_URL=http://localhost:3000/api`. No publicar esos archivos.
2. Desde `backend`, ejecutar `npm.cmd run audit:oracle` y `npm.cmd run test:permissions`. El segundo usa fixtures y revierte la transacción incluso si falla un caso; informa cada código HTTP esperado. Para producción, es preferible ejecutar estas pruebas sobre una copia de pruebas.
3. Desde `frontend`, ejecutar `npm.cmd run lint`, `npm.cmd run build` y `npm.cmd run test:permissions`. La configuración de navegador usa Microsoft Edge instalado y puerto 5179 libre. Playwright es dependencia de desarrollo y se instala con `npm.cmd ci`.
4. Para probar la aplicación manualmente: iniciar backend con `npm.cmd run dev` y frontend con `npm.cmd run dev`, en terminales separadas. Iniciar sesión como Empleado de consulta. Debe ver Clientes/Productos y sus listados, sin crear/editar/activar/desactivar ni administración de usuarios/roles.
5. En otra sesión como Administrador, conceder `CLIENTES_CREAR` al rol de prueba. La sesión Empleado debe mostrar Nuevo cliente al recuperar foco o dentro de 15 segundos. Abrir un formulario, retirar ese permiso y comprobar que desaparece tras refrescar permisos. Las peticiones backend posteriores a la revocación deben ser 403 incluso antes del refresco visual. Repetir con creación/edición de productos.
6. Conceder solamente `CLIENTES_CREAR` o `PRODUCTOS_CREAR` en un rol de prueba: debe permitirse crear sin consultar el listado. Un permiso EDITAR sin VER permite la operación por API, pero para seleccionar registros en la tabla de React se necesita VER; no se concede consulta implícitamente.
7. Usar Postman o PowerShell con el JWT del Empleado. GET `/api/clientes` y `/api/productos` deben responder 200; POST/PUT/PATCH de esos módulos deben responder 403 si no tiene su permiso. Quitar Authorization da 401; un JWT alterado o expirado da 401. Repetir las operaciones de la tabla de endpoints con sus permisos respectivos.
8. En un rol de prueba con `USUARIOS_GESTIONAR`, intentar crear una cuenta `idRol: 1`, cambiar el propio rol, modificar una cuenta de otro rol, cambiar el propio estado o inyectar `permisos`: debe devolver 403. Con `ROLES_GESTIONAR` sin ser rol 1, PUT de asignaciones también debe devolver 403. El Administrador tampoco puede modificar las asignaciones del rol 1.
9. La suite automatizada comprueba usuario y rol inactivos, token expirado, y cambios de rol con el mismo JWT sin modificar las cuentas existentes. Para repetir manualmente las inactivaciones, utilizar exclusivamente cuentas/roles de prueba y volver a habilitarlos desde una sesión administrativa autorizada.

Ejemplo de petición directa en PowerShell, usando un token obtenido al iniciar sesión y un ID de prueba existente:

```powershell
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri 'http://localhost:3000/api/clientes' -Headers $headers
# Con CLIENTES_VER solamente, esta escritura debe devolver HTTP 403:
Invoke-WebRequest -Uri "http://localhost:3000/api/clientes/$idClientePrueba/estado" `
  -Method Patch -Headers $headers -ContentType 'application/json' -Body '{"estado":"I"}'
# Sin token, debe devolver HTTP 401:
Invoke-WebRequest -Uri 'http://localhost:3000/api/clientes'
```

## Pendientes funcionales

- Implementar consulta de bitácora, definir los eventos que se registrarán y proteger sus endpoints con `BITACORA_VER`.
- Implementar exportación PDF/Excel y protegerla con `REPORTES_EXPORTAR`, además del permiso de consulta del conjunto de datos exportado. Tener paquetes PDF/Excel instalados no equivale a tener exportación implementada.
- Completar alta, edición y activación/desactivación de roles si forman parte del alcance funcional deseado; actualmente no hay endpoints para esas operaciones.
- Pruebas con COMMIT real, concurrencia y navegador conectado al backend/Oracle completos quedan pendientes; no se presentan como aprobadas.
