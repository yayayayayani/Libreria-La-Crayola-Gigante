# Casos de prueba · Sprint 2

Fecha de ejecución: 15/10/2026 (Guatemala). Backend: Node + HTTP/JWT + Oracle real. Las pruebas crean sus propios registros y los eliminan al finalizar. No envían correo externo.

## Ejecución

```text
cd backend
npm run test:sprint2
npm run test:permissions

cd ../frontend
npm run lint
npm run build
npx playwright test tests/sprint2.spec.js
npx playwright test tests/permisos.spec.js
```

Configurar `.env` y aplicar migración antes de pruebas backend. Preferir esquema de pruebas. El navegador utilizado por la configuración Playwright es Microsoft Edge; las pruebas frontend simulan respuestas API y no sustituyen una prueba navegador + API + Oracle completa.

## Casos backend

| Caso | Preparación y acción | Resultado esperado | Resultado |
|---|---|---|---|
| CP01 | Producto stock 10; recibir 3 a Q2.25 | Stock 13, total Q6.75, un detalle/recepción/movimiento | Aprobado |
| CP02 | Repetir clave y factura ya guardadas | HTTP 409, stock sin nuevo incremento | Aprobado |
| CP03 | Cantidad 0, negativa, fraccionaria; costo negativo o tres decimales | HTTP 400 en cada variante | Aprobado |
| CP04 | Producto inactivo o repetido en el detalle | HTTP 400, saldo sin cambios | Aprobado |
| CP05 | Registrar dos compras simultáneas de tres unidades | Ambas exitosas, saldo aumenta seis | Aprobado |
| CP06 | Mínimo igual al stock y luego recibir tres unidades | Alerta activa en igualdad; se resuelve al superar mínimo | Aprobado |
| CP07 | Usuario sin permisos y token inválido | 403/401; rutas nuevas protegidas | Aprobado |
| CP08 | Nombres con dígitos y nombres con tildes/guiones | Rechaza dígitos; acepta formato personal válido | Aprobado |
| CP09 | NIT tradicional, 13 dígitos y letras arbitrarias | Acepta formatos soportados y rechaza inválidos | Aprobado |
| CP10 | Correo registrado en mayúsculas para otra cuenta | 409, un aviso pendiente al titular; reintento no repite aviso de la hora | Aprobado |
| CP11 | Editar producto enviando stock obsoleto 0 | Conserva saldo real de compras | Aprobado |
| CP12 | Tres unidades a Q0.10 y total manipulado | Total servidor Q0.30; rechaza detalle vacío | Aprobado |
| CP13 | Fallo de transporte y posterior entrega a servidor SMTP local de pruebas | Conserva pendiente, aumenta intentos y pasa a ENVIADO al aceptar SMTP | Aprobado |

Resultado comprobado: **13/13 casos del Sprint 2 y 187/187 casos de regresión de permisos aprobados**. El script anterior de permisos se actualizó para proporcionar el correo ahora requerido; conserva sus controles de autorización. CP13 utiliza un servidor SMTP efímero en 127.0.0.1; no contacta destinatarios externos ni prueba Gmail.

## Casos de navegador

| Caso | Escenario | Resultado esperado |
|---|---|---|
| UI01 | Registrar compra con producto/cantidad/costo | Payload correcto, clave de operación y confirmación visible |
| UI02 | Cambiar stock en servidor simulado | Se actualiza en consulta periódica y resuelve alerta |
| UI03 | Usuario solo de consulta de inventario | No ofrece ni consulta compras/proveedores; no permite cambiar mínimo |
| UI04 | Nombre personal con números | Validación HTML bloquea envío |
| UI05 | Correo duplicado | Aviso visible; conserva formulario para corregir |

Los cinco casos nuevos de navegador obtuvieron **5/5 aprobados**. La regresión anterior de navegador obtuvo **13/13 aprobados**. Compilación de producción y lint sin errores.

## Pruebas manuales externas pendientes

- SMTP real: alta, modificación, duplicado y recepción en la cuenta del integrante. No configurado durante esta ejecución.
- Conexión de las tres casas mediante la URL del anfitrión. No se dispone de esos equipos ni de la red configurada en esta sesión.
- Aceptación funcional por el equipo y docente en Sprint Review.

Los casos automatizados acreditan comportamiento técnico, no sustituyen firmas de aceptación ni prueban entrega de correo en la bandeja del destinatario.

## Validaci?n adicional de entrada

`npm run test:validation` en backend: aprobado. Verifica que cuerpos y detalles nulos, listas, booleanos o valores escalares se rechacen con estado 400 antes de procesar una compra.

La configuraci?n Gmail se describe en [GMAIL.md](../GMAIL.md). `npm run verify:mail` comprueba autenticaci?n sin enviar mensajes; la comprobaci?n actual detect? campos SMTP a?n incompletos, por lo que no se acredita entrega real.

Reejecuci?n del 15 de octubre de 2026 con DB_ENGINE=postgres: los 13 casos de backend Sprint 2 aprobaron contra Neon, incluida la prueba SMTP local. M?s la prueba adicional de validaci?n: 14 pruebas aprobadas en esta revisi?n.
