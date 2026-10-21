// Reinicio explícito de datos para la entrega. No se ejecuta al iniciar la app.
require('dotenv').config({quiet:true});
const fs=require('node:fs');
const path=require('node:path');
const {conectar,filas}=require('../src/services/db');
const driver=require('../src/config/driver');
async function main(){
  if(process.argv[2]!=='--vaciar-datos-de-negocio')throw new Error('Se requiere --vaciar-datos-de-negocio');
  if(driver.motor()!=='postgres')throw new Error('Esta limpieza es para PostgreSQL');
  const c=await conectar();
  try{
    const tablas=(await filas(c,"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).map(t=>t.TABLENAME);
    const conocidas=new Set('aprobaciones bitacora categorias clientes compras comprobantes correos_pendientes detalle_compras detalle_pedidos detalle_ventas imagenes_productos migraciones movimientos_financieros movimientos_inventario movimientos_puntos pagos pedidos permisos productos proveedores recepciones recuperaciones_compra rol_permiso roles usuarios ventas'.split(' '));
    if(tablas.some(t=>!conocidas.has(t)))throw new Error('Hay tablas nuevas: revisar el alcance antes de limpiar');
    const q=n=>'"'+n.replaceAll('"','""')+'"';
    await c.execute('SET LOCAL lock_timeout=\'15s\'');
    await c.execute(`LOCK TABLE ${tablas.map(t=>'public.'+q(t)).join(',')} IN ACCESS EXCLUSIVE MODE`);
    const conservar=await filas(c,"SELECT id_usuario,nombre_usuario FROM usuarios WHERE id_rol IN (1,3) AND estado='A' AND nombre_usuario NOT LIKE 'S3_%' AND nombre_completo NOT ILIKE '%prueba%' ORDER BY id_usuario");
    if(!conservar.length)throw new Error('No existe una cuenta administrativa real que conservar');
    const respaldo={fecha:new Date().toISOString(),motor:'postgres',tablas:{},secuencias:await filas(c,"SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public'"),cuentasConservadas:conservar.map(u=>u.ID_USUARIO)};
    for(const tabla of tablas){
      const [r]=await filas(c,`SELECT COALESCE(json_agg(row_to_json(t)),'[]'::json)::text contenido FROM public.${q(tabla)} t`);
      respaldo.tablas[tabla]=JSON.parse(r.CONTENIDO);
    }
    const dir=path.resolve(__dirname,'../../.migration-backups');fs.mkdirSync(dir,{recursive:true});
    const archivo=path.join(dir,`antes-limpieza-sprint3-${Date.now()}.json`);
    fs.writeFileSync(archivo,JSON.stringify(respaldo),{flag:'wx',mode:0o600});
    const comprobacion=JSON.parse(fs.readFileSync(archivo,'utf8'));
    if(Object.keys(comprobacion.tablas).length!==tablas.length)throw new Error('Respaldo incompleto');
    const configuracion=new Set(['usuarios','roles','permisos','rol_permiso','migraciones']);
    const negocio=tablas.filter(t=>!configuracion.has(t));
    await c.execute(`TRUNCATE TABLE ${negocio.map(t=>'public.'+q(t)).join(',')} CONTINUE IDENTITY`);
    const ids=conservar.map(u=>u.ID_USUARIO);
    await c.execute(`DELETE FROM usuarios WHERE id_usuario NOT IN (${ids.map((_,i)=>':u'+i).join(',')})`,Object.fromEntries(ids.map((id,i)=>['u'+i,id])));
    await c.execute('DELETE FROM rol_permiso WHERE id_rol NOT IN (1,2,3)');
    await c.execute('DELETE FROM roles WHERE id_rol NOT IN (1,2,3)');
    const despues={};
    for(const t of tablas){const [r]=await filas(c,`SELECT COUNT(*) n FROM public.${q(t)}`);despues[t]=r.N;if(negocio.includes(t)&&r.N!==0)throw new Error('Tabla de negocio no vacía');}
    await c.commit();
    const informe={fecha:new Date().toISOString(),respaldo:path.relative(path.resolve(__dirname,'../..'),archivo),antes:Object.fromEntries(tablas.map(t=>[t,respaldo.tablas[t].length])),despues,cuentasConservadas:conservar.map(u=>u.ID_USUARIO),criterio:'Negocio vacío; cuentas administrativas activas reales, roles 1/2/3, permisos y migraciones conservados. No se cambian contraseñas ni secuencias.'};
    fs.writeFileSync(path.resolve(__dirname,'../../.tools/entrega3/limpieza.json'),JSON.stringify(informe,null,2));
    console.log(JSON.stringify({estado:'Limpieza confirmada',tablasNegocioVacias:negocio.length,cuentasAdministrativas:ids.length,roles:despues.roles,permisos:despues.permisos}));
  }catch(e){await c.rollback();throw e;}finally{await c.close();await driver.cerrarPool();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
