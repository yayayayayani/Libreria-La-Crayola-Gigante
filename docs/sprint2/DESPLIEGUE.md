# Tres estudiantes desde casas distintas y correo real

**Actualización:** el equipo eligió Neon y la migración fue realizada. La guía vigente es [Neon y acceso del equipo](../NEON.md). Las opciones con Oracle/Tailscale siguientes son alternativas históricas, no la configuración activa.

## Opciones

| Opción | Costo de servicio | Ventaja | Condición |
|---|---|---|---|
| Una PC + Tailscale Personal | Plan personal gratuito para hasta seis usuarios, según consulta del 15/10/2026 | Aprovecha Oracle ya instalado; menor configuración | PC encendida, conectada y sin suspensión; consume electricidad |
| Oracle Cloud Always Free | Recursos gratuitos dentro de sus límites | No depender de una PC encendida | Mayor trabajo de instalación, disponibilidad/cupos y políticas de inactividad; distinguir prueba temporal de recursos Always Free |
| Servidor de la universidad | Depende de lo que ofrezca la institución | Puede incluir soporte y acceso permanente | Consultar disponibilidad y autorización con el docente |

Recomendación para esta entrega: **una PC con Oracle y backend, compartida por Tailscale**. El plan personal admite al equipo de tres: [precios oficiales](https://tailscale.com/pricing). Oracle Cloud tiene recursos Always Free, pero puede recuperar instancias inactivas: [documentación oficial](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm). No hace falta migrar de Oracle a otro motor para trabajar juntos.

## Configuración recomendada

1. Elegir el equipo anfitrión, por ejemplo el que ya tiene Oracle funcionando. Los otros dos necesitan navegador y Tailscale; no necesitan una copia de Oracle para usar el sistema.
2. Instalar Tailscale en los tres equipos. Crear la red personal e invitar a los dos compañeros usando cuentas propias. Iniciar sesión y verificar que los tres equipos aparecen conectados.
3. En el anfitrión, conservar `backend/.env` con Oracle local (`DB_CONNECT_STRING=localhost:1521/ORCLPDB`, o el servicio real). No colocar credenciales en React ni en Git.
4. En `backend`: `npm install` y `npm run migrate:sprint2` (una vez por esquema; comando reejecutable).
5. En `frontend`: `npm install` y `npm run build`. La compilación de producción usa `/api` en la misma dirección que la web, incluso si el entorno de desarrollo tenía localhost.
6. En `backend`: `npm start`. Sirve React compilado y API en el puerto 3000.
7. Consultar la IP privada Tailscale del anfitrión (`tailscale ip -4`) y abrir desde cada casa `http://IP_TAILSCALE:3000`. Sustituir IP_TAILSCALE por el valor real.
8. Si Windows bloquea la entrada, habilitar TCP 3000 **solo desde las IP Tailscale de los compañeros** en el firewall del anfitrión. No es necesario publicar Oracle/1521 en internet ni abrir puertos del router.
9. Crear una cuenta distinta del sistema para cada integrante. El administrador asigna los permisos nuevos desde Roles y Permisos. No compartir el usuario administrador entre los tres.
10. Mantener Oracle y `npm start` activos y evitar suspensión durante la demostración. Al actualizar código, recompilar React y reiniciar backend.

Para acceso HTTPS privado puede configurarse Tailscale Serve según la documentación de Tailscale. Este proyecto no instala Tailscale, cambia el firewall ni publica una máquina automáticamente.

Git comparte código; **no sincroniza bases de datos**. Cada copia local de Oracle sería una base independiente. Los cambios se ven porque los navegadores apuntan al mismo servidor y este usa un único Oracle. La aplicación consulta los listados cada cinco segundos y al recuperar foco; es actualización periódica, no WebSocket instantáneo.

## Ensayo en tres casas

1. A entra a Compras; B y C abren Inventario sobre la misma URL privada.
2. Elegir un producto, anotar su stock, y configurar un mínimo igual al stock. B y C deben ver «Reponer».
3. A registra una compra recibida de 3 unidades. En hasta aproximadamente cinco segundos, B y C deben observar stock anterior + 3 y la alerta resuelta.
4. Revisar historial: misma compra, recepción y movimiento en los tres navegadores.
5. A y B registran facturas distintas del mismo producto simultáneamente; confirmar que se suman ambas cantidades.
6. Registrar capturas y fecha en SCRUM.md. Esta prueba remota no está marcada como realizada.

## Configurar correo real

El servidor usa Nodemailer con SMTP. No requiere conectar Gmail al chat. Gmail con contraseña de aplicación es una opción para una demostración si la cuenta lo permite. Google exige verificación en dos pasos para usar contraseñas de aplicación y algunas cuentas no las ofrecen: [ayuda oficial](https://support.google.com/mail/answer/185833?hl=es).

Agregar al `backend/.env` del anfitrión, con valores propios:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=cuenta-remitente@gmail.com
SMTP_PASSWORD=CONTRASENA_DE_APLICACION
SMTP_FROM=cuenta-remitente@gmail.com
SMTP_ENABLED=true
```

Con otro proveedor usar su servidor y credenciales. Para STARTTLS en puerto 587 configurar `SMTP_SECURE=false`; el transporte exige TLS. No se desactiva la validación de certificados. Reiniciar backend después de cambiar `.env`.

El worker procesa al arrancar y cada 60 segundos. Los eventos se guardan en Oracle, incluso sin SMTP configurado. Al configurar un remitente se procesarán los avisos pendientes; revisar primero la cola si se hicieron registros de demostración. Nunca usar correos de terceros sin consentimiento en datos de prueba.

Consulta de diagnóstico sin mostrar destinatarios ni mensajes:

```sql
SELECT estado, intentos, COUNT(*) total
FROM correos_pendientes
GROUP BY estado, intentos;
```

Prueba manual autorizada con direcciones del equipo:

1. Registrar una cuenta con correo de un integrante: debe aparecer aviso de cuenta registrada en su correo.
2. Intentar registrar otra cuenta con la misma dirección en mayúsculas: la aplicación devuelve conflicto y no crea la cuenta; el titular recibe aviso de reutilización rechazada.
3. Revisar spam y la cola. ENVIADO significa aceptación del servidor SMTP, no lectura ni garantía de bandeja principal.
4. Si falla, `ULTIMO_ERROR` conserva un código técnico; corregir configuración. Después de cinco fallos deja de reintentar automáticamente. Un administrador puede reiniciar INTENTOS únicamente para las filas revisadas.

Semántica de envío: al menos una vez. Si SMTP acepta un correo y el proceso cae antes del commit, podría reenviarlo. Se usa Message-ID estable, pero la eliminación de duplicados depende del proveedor. No se prometen entregas exactamente una vez.

Estado de esta instalación: Oracle local migrado; no se configuró Tailscale ni SMTP ni se envió correo externo durante la implementación.
