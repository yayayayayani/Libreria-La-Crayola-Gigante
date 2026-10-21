# Correo de notificaciones

El backend procesa notificaciones cuando `SMTP_ENABLED=true`. Configurar en `backend/.env` las variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` con los datos entregados por el proveedor del correo.

Para TLS implícito se utiliza normalmente el puerto 465 y `SMTP_SECURE=true`. Para STARTTLS, configurar el puerto indicado por el proveedor y `SMTP_SECURE=false`. El servicio requiere TLS cuando se usa STARTTLS.

Verificar desde `backend` con `npm run verify:mail`. Reiniciar el backend después de cambiar variables. Si no se utilizará correo, mantener `SMTP_ENABLED=false`.

Las claves y direcciones privadas no deben aparecer en documentos ni capturas. Utilizar el mecanismo de autenticación SMTP habilitado por el proveedor en la cuenta. La creación de una notificación pendiente no demuestra su entrega: comprobar el estado y la bandeja del destinatario.
