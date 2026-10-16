const nodemailer = require('nodemailer');
const { conectar, filas } = require('./db');
async function encolar(c, destinatario, asunto, mensaje) {
  await c.execute('INSERT INTO correos_pendientes(destinatario,asunto,mensaje) VALUES (:destinatario,:asunto,:mensaje)',{destinatario,asunto,mensaje});
}
async function avisarDuplicado(c, correo) {
  // Solo se avisa al dueño de una dirección ya registrada; máximo un aviso por hora.
  const encontrados = await filas(c,'SELECT correo FROM usuarios WHERE LOWER(TRIM(correo))=:correo',{correo});
  if(!encontrados.length) return;
  const recientes = await filas(c,"SELECT id_correo FROM correos_pendientes WHERE destinatario=:correo AND asunto='Intento de reutilización de correo' AND creado_en > SYSTIMESTAMP - INTERVAL '1' HOUR",{correo});
  if(!recientes.length) {
    await encolar(c,correo,'Intento de reutilización de correo','Se intentó asignar tu correo a otra cuenta en Librería La Crayola Gigante. La operación fue rechazada y tu cuenta no cambió. Si necesitas ayuda, contacta al administrador.');
    await c.commit();
  }
}
function transporte() {
  if(!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM) return null;
  return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT || 465),secure:process.env.SMTP_SECURE !== 'false',requireTLS:process.env.SMTP_SECURE === 'false',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:10000,socketTimeout:15000});
}
async function procesarCorreos(transport = transporte(), idCorreo = null) {
  if(!transport) return {configurado:false,enviados:0};
  const c = await conectar(); let enviados=0;
  try {
    // SKIP LOCKED permite varios workers sin enviar simultáneamente la misma fila.
    const pendientes = await filas(c,"SELECT * FROM correos_pendientes WHERE estado='PENDIENTE' AND intentos < 5 AND (id_correo=:id OR :id IS NULL) ORDER BY id_correo FOR UPDATE SKIP LOCKED",{id:idCorreo});
    for(const p of pendientes) {
      try {
        await transport.sendMail({from:process.env.SMTP_FROM,to:p.DESTINATARIO,subject:p.ASUNTO,text:p.MENSAJE,messageId:`<crayola-${p.ID_CORREO}@${(process.env.SMTP_FROM?.split('@')[1] || 'localhost').replace(/[<>]/g,'')}>`});
        await c.execute("UPDATE correos_pendientes SET estado='ENVIADO',intentos=intentos+1,enviado_en=SYSTIMESTAMP,ultimo_error=NULL WHERE id_correo=:id",{id:p.ID_CORREO}); enviados++;
      } catch(e) {
        await c.execute('UPDATE correos_pendientes SET intentos=intentos+1,ultimo_error=:error WHERE id_correo=:id',{id:p.ID_CORREO,error:String(e.code || 'SMTP_ERROR').slice(0,100)});
      }
    }
    await c.commit(); return {configurado:true,enviados};
  } finally {await c.close();}
}
function iniciarCorreos() {
  if(process.env.SMTP_ENABLED !== 'true') return;
  let ocupado=false;
  const ejecutar=async()=>{if(ocupado)return;ocupado=true;try{await procesarCorreos();}catch(e){console.error('Cola de correos:',e.code || e.name);}finally{ocupado=false;}};
  const timer=setInterval(ejecutar,60000);timer.unref();
  ejecutar();
}
module.exports={encolar,avisarDuplicado,procesarCorreos,iniciarCorreos,transporte};
