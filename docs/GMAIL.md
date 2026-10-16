# Configurar Gmail para los avisos

1. En la cuenta remitente activa la verificación en dos pasos.
2. Abre https://myaccount.google.com/apppasswords y crea una contraseña de aplicación llamada Librería. Google puede restringir esta opción en cuentas administradas o con Protección Avanzada. Ayuda oficial: https://support.google.com/accounts/answer/185833?hl=es.
3. Completa **backend/.env**, no frontend/.env:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tu-cuenta@gmail.com
SMTP_PASSWORD=contraseña_de_aplicación_sin_espacios
SMTP_FROM=tu-cuenta@gmail.com
SMTP_ENABLED=false
```

4. Desde backend ejecuta `npm run verify:mail`. Verifica conexión y autenticación sin enviar mensajes. EAUTH suele indicar credenciales rechazadas; ETIMEDOUT o ECONNECTION indican revisar conectividad. Una verificación exitosa no prueba llegada a la bandeja.
5. Revisa los destinatarios pendientes antes de activar el envío. Cambia SMTP_ENABLED=true y reinicia el backend para procesar la cola existente y los avisos nuevos. Las altas y modificaciones de usuarios generan notificaciones; el correo duplicado se rechaza y genera un aviso al titular registrado, limitado a uno por hora.
6. Prueba con una cuenta cuyo correo controles y comprueba la bandeja y Spam. ENVIADO indica que el servidor SMTP aceptó el mensaje, no garantiza su entrega en la bandeja principal.

La cola se consulta al arrancar y cada minuto. Tras cinco intentos fallidos el mensaje permanece pendiente para revisión. No se guardan contraseñas SMTP en Neon ni deben incluirse en Git. Al menos un backend con SMTP habilitado debe permanecer encendido para enviar; la base de datos compartida sigue accesible aunque ese equipo esté apagado.

Estado de esta entrega: cola probada con servidor SMTP local; conexión y entrega reales por Gmail pendientes hasta configurar la cuenta.
