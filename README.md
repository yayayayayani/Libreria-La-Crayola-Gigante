# Librería La Crayola Gigante

Sistema web de gestión administrativa para una librería, desarrollado como proyecto académico mediante entregas incrementales (Sprints).

## Descripción

**Base compartida activa: Neon / PostgreSQL.** Se migraron las 15 tablas de Oracle preservando sus datos; Oracle permanece como respaldo independiente. Ver [guía de Neon y trabajo entre compañeros](docs/NEON.md). Las instrucciones Oracle de abajo se conservan para el entorno anterior; para el uso actual seguir la guía de Neon.

**Actualización Sprint 2:** compras, proveedores, recepción completa, entradas de inventario, movimientos, mínimos, alertas, validaciones y notificaciones SMTP. Ver [documentación de la Entrega 2](docs/sprint2/README.md) y [guía para trabajar desde tres casas](docs/sprint2/DESPLIEGUE.md). La recepción se confirma al registrar la compra y actualiza existencias en una transacción.

La aplicación centraliza la administración de usuarios, roles, permisos, clientes y productos. Los clientes son registros comerciales, **no** usuarios que inician sesión: el acceso al sistema está reservado a personal autorizado.

## Tecnologías

- **Frontend:** React y Vite.
- **Backend:** Node.js y Express (API REST).
- **Base de datos activa:** PostgreSQL en Neon; Oracle se conserva como respaldo histórico.
- **Seguridad:** JWT y bcryptjs.
- **Reportes futuros:** exportación todavía no implementada; se retiraron las dependencias sin uso.
- **Pruebas:** scripts de integración del backend y Playwright para frontend, según la auditoría de permisos del Sprint 1.

## Funcionalidades del Sprint 1

- Inicio de sesión y cierre de sesión.
- Gestión de usuarios, asignación de roles y activación/desactivación.
- Consulta de roles y administración de sus permisos.
- Autorización por permisos tanto en React como en los endpoints de Express.
- Registro, consulta, edición y activación/desactivación de clientes.
- Registro, consulta, edición y activación/desactivación de productos.
- Registro y consulta básica de categorías.
- Menú principal adaptado a las funciones autorizadas.
- Validaciones básicas y contraseñas almacenadas como hash.

> **Alcance:** la creación, edición y activación/desactivación de *roles* todavía no está implementada completamente. Las funciones de bitácora y exportación a PDF/Excel siguen pendientes, aunque sus permisos estén definidos en Oracle.

## Estructura del proyecto

```text
Libreria-La-Crayola-Gigante/
├── backend/       # API REST, controladores, rutas, middlewares y scripts
├── frontend/      # Aplicación React + Vite
├── database/      # Scripts SQL de Oracle
├── docs/          # Documentación del proyecto y de los Sprints
└── .gitignore
```

## Instrucciones históricas de Oracle

Las secciones siguientes de instalación Oracle son de referencia. Para el entorno activo usar [NEON.md](docs/NEON.md).

## Requisitos previos

- Node.js y npm compatibles con las dependencias del repositorio.
- Oracle Database instalado, iniciado y con una PDB disponible.
- Oracle SQL Developer para administrar el esquema y ejecutar el SQL.
- Git, para clonar y versionar el proyecto.

## Instalación local

### 1. Clonar el repositorio

```bash
git clone https://github.com/yayayayayani/Libreria-La-Crayola-Gigante.git
cd Libreria-La-Crayola-Gigante
```

> El repositorio es privado: es necesario tener autorización para clonarlo.

### 2. Preparar Oracle

1. Abrir Oracle SQL Developer y conectarse a la PDB correspondiente (en el entorno de desarrollo se utilizó `ORCLPDB`).
2. Crear o utilizar el esquema `LIBRERIA_CRAYOLA` con permisos adecuados.
3. Ejecutar el script SQL del Sprint 1 ubicado en `database/` (si ya fue agregado al repositorio), verificando que incluya tablas, relaciones y datos iniciales necesarios.
4. Comprobar que existen `USUARIOS`, `ROLES`, `PERMISOS`, `ROL_PERMISO`, `CLIENTES`, `CATEGORIAS`, `PRODUCTOS` y `BITACORA`.
5. Preparar un usuario Administrador inicial utilizando el script de desarrollo correspondiente, si está disponible. No se incluye ninguna contraseña real en este README.

### 3. Configurar y ejecutar backend

```bash
cd backend
npm install
```

Crear `backend/.env` (no debe subirse a Git):

```dotenv
PORT=3000
DB_USER=LIBRERIA_CRAYOLA
DB_PASSWORD=COLOCA_AQUI_TU_CONTRASENA_LOCAL
DB_CONNECT_STRING=localhost:1521/ORCLPDB
JWT_SECRET=COLOCA_UN_SECRETO_LARGO_Y_ALEATORIO
JWT_EXPIRES_IN=2h
```

Iniciar API:

```bash
npm run dev
```

Comprobar: `http://localhost:3000/api`.

### 4. Configurar y ejecutar frontend

En otra terminal:

```bash
cd frontend
npm install
```

Crear `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Ejecutar:

```bash
npm run dev
```

Abrir `http://localhost:5173` (o el puerto que indique Vite).

## Permisos registrados

| Código | Alcance |
| --- | --- |
| `USUARIOS_GESTIONAR` | Consultar, crear y modificar usuarios, con restricciones administrativas. |
| `ROLES_GESTIONAR` | Consultar roles y administrar asignaciones, sujeto a reglas adicionales. |
| `CLIENTES_VER` | Consultar clientes. |
| `CLIENTES_CREAR` | Crear clientes. |
| `CLIENTES_EDITAR` | Modificar y cambiar estado de clientes. |
| `PRODUCTOS_VER` | Consultar productos. |
| `PRODUCTOS_CREAR` | Crear productos y categorías. |
| `PRODUCTOS_EDITAR` | Modificar y cambiar estado de productos. |
| `BITACORA_VER` | Reservado para la futura consulta de bitácora. |
| `REPORTES_EXPORTAR` | Reservado para exportación PDF/Excel futura. |

Los permisos son verificados en el backend. Ocultar acciones en React **no reemplaza** el control de acceso a la API.

## Pruebas

La auditoría del Sprint 1 **reportó** 187 casos de integración backend aprobados y 13 escenarios frontend aprobados, además de compilación y lint satisfactorios. Estas pruebas no sustituyen una verificación manual completa con navegador y Oracle conectados extremo a extremo.

Si los scripts están presentes en tu versión del repositorio, ejecútalos así:

```bash
# Desde backend
npm run audit:oracle
npm run test:permissions

# Desde frontend
npm run lint
npm run build
npm run test:permissions
```

Realiza pruebas automatizadas sobre un entorno de prueba cuando sea posible. No difundas archivos `.env`, credenciales ni tokens JWT.

## Próximos Sprints

- Bitácora de acciones de usuarios.
- Reportes y exportaciones con PDFKit y ExcelJS.
- Ventas, detalle de ventas y facturación.
- Historial de compras por cliente (incluido NIT).
- Programa de puntos y movimientos de puntos.
- Operaciones completas de mantenimiento de roles, según alcance acordado.

## Equipo

Equipo de tres estudiantes: **David, Yordy y Daylin**. La configuración compartida del Sprint 2 permite trabajar sobre un mismo servidor desde distintas casas.

## Estado

### Ventas a clientes y documentos

El acceso a Ventas a clientes está oculto hasta el siguiente sprint mediante `VENTAS_HABILITADAS = false` en `frontend/src/features.js`. La implementación y los datos se conservan.

Ejecutar `npm run migrate:sales` desde `backend` antes de iniciar esta versión y recompilar con `npm run build` desde `frontend`. La migración añade ventas, detalles y movimientos de salida; asigna `VENTAS_GESTIONAR` al rol administrador (ID 1). Otros roles pueden recibirlo desde Roles y Permisos. Crear un cliente durante una venta requiere además `CLIENTES_CREAR`.

En **Ventas a clientes** se puede seleccionar un cliente activo, añadir uno nuevo o usar **Consumidor final (CF)** sin crear un cliente. La confirmación calcula precios en el servidor y descuenta inventario dentro de la misma transacción. Los reintentos con la misma clave no duplican la venta. Las compras a proveedores siguen registrándose en **Compras e inventario**.

Proveedores y clientes permiten elegir NIT (7 dígitos y un verificador, con guion automático) o DPI/CUI (13 dígitos). Los documentos se guardan sin guion para evitar duplicados equivalentes. El nombre comercial admite letras, números y símbolos, de 1 a 150 caracteres.

Validación: `node --test tests/validaciones.test.js tests/sprint2.test.js` en backend y `npx playwright test tests/sprint2.spec.js` en frontend. Las pruebas de backend usan registros temporales en la base configurada y los eliminan al terminar.

**Sprint 1:** funcionalidades principales implementadas; documentación y evidencias de entrega sujetas a revisión final.

**Sprint 2:** incremento implementado y migración local aplicada. Activación de SMTP, configuración remota y evidencias de las ceremonias reales pendientes del equipo; consultar el estado detallado en `docs/sprint2/`.

## Revisión de presentación, fotografías y documentos

La revisión del 16/10/2026 agrega fotografías compartidas de productos y una interfaz renovada. Consultar [el paquete editable de Entrega 2](docs/entrega2/README.md). Antes de iniciar una copia actualizada, instalar dependencias y ejecutar `npm run migrate:images` en backend; después compilar frontend. El motor activo probado es PostgreSQL.
