// Comprueba autenticación SMTP; no envía mensajes ni procesa la cola.
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
const {transporte} = require('../src/services/correos');
async function main() {
  const smtp = transporte();
  if (!smtp) {
    console.error('Completa SMTP_HOST, SMTP_USER, SMTP_PASSWORD y SMTP_FROM en backend/.env.');
    process.exitCode = 1;
    return;
  }
  try {
    await smtp.verify();
    console.log('Conexión y autenticación SMTP correctas. No se enviaron correos.');
    console.log(process.env.SMTP_ENABLED === 'true' ? 'Envío automático habilitado al iniciar el backend.' : 'Envío automático desactivado (SMTP_ENABLED=false).');
  } catch (error) {
    const code = String(error.code || 'SMTP_ERROR').replace(/[^A-Z0-9_]/g,'');
    console.error(`No se pudo verificar SMTP (${code}). Revisa la configuración y la contraseña de aplicación.`);
    process.exitCode = 1;
  } finally { smtp.close(); }
}
main().catch(() => { console.error('No se pudo iniciar la comprobación SMTP.'); process.exitCode=1; });
