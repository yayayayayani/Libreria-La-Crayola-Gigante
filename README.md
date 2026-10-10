# Librería La Crayola Gigante

Sistema web de gestión administrativa para una librería, desarrollado como proyecto académico mediante entregas incrementales (Sprints).

## Descripción

La aplicación centraliza la administración de usuarios, roles, permisos, clientes y productos. Los clientes son registros comerciales, **no** usuarios que inician sesión: el acceso al sistema está reservado a personal autorizado.

## Tecnologías

- **Frontend:** React y Vite.
- **Backend:** Node.js y Express (API REST).
- **Base de datos:** Oracle Database; administración con Oracle SQL Developer.
- **Seguridad:** JWT y bcryptjs.
- **Reportes futuros:** PDFKit y ExcelJS (previstos; exportación aún no implementada).
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

Proyecto académico inicialmente organizado por **David, Yordy y Daylin**. El desarrollo actual se está realizando de manera individual.

## Estado

**Sprint 1:** funcionalidades principales implementadas; documentación y evidencias de entrega sujetas a revisión final.
