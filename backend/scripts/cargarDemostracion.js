// Datos ficticios; ejecución manual, sin cambiar las cuentas existentes.
require('dotenv').config({quiet:true});
const fs=require('node:fs'),path=require('node:path');
const {randomBytes,randomUUID}=require('node:crypto');
const bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const {conectar,filas,idSalida}=require('../src/services/db');
const driver=require('../src/config/driver');
const root=path.resolve(__dirname,'../..');
const stateFile=path.join(root,'.migration-backups/demo-libreria-v1.json');
const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{done:[]};
const save=()=>{fs.mkdirSync(path.dirname(stateFile),{recursive:true});fs.writeFileSync(stateFile,JSON.stringify(state,null,2));};
function nitDemo(n){const base=String(n);const sum=[...base].reduce((s,d,i)=>s+Number(d)*(base.length+1-i),0);const digit=(11-sum%11)%11;return base+(digit===10?'K':digit);}
const groups=[
 ['Cuadernos y papel',[['Cuaderno universitario rayado',18],['Cuaderno cuadriculado 100 hojas',16],['Cuaderno doble línea',12],['Resma papel carta 500 hojas',42],['Papel construcción 24 hojas',15]]],
 ['Escritura',[['Bolígrafo azul',3],['Bolígrafo negro',3],['Lápiz de grafito HB',2.5],['Portaminas 0.5 mm',12],['Marcadores permanentes 4 colores',22]]],
 ['Arte y color',[['Crayones de madera 24 colores',35],['Crayones de cera 12 colores',14],['Acuarelas 12 colores',28],['Témperas 6 colores',25],['Pinceles escolares 6 piezas',20]]],
 ['Útiles escolares',[['Regla transparente 30 cm',5],['Juego de geometría',18],['Borrador blanco',3],['Sacapuntas con depósito',6],['Tijera escolar punta redonda',10]]],
 ['Adhesivos y manualidades',[['Pegamento blanco 120 ml',9],['Pegamento en barra 21 g',8],['Cinta adhesiva transparente',7],['Foamy colores 10 hojas',18],['Silicón en barras paquete',15]]],
 ['Oficina y archivo',[['Archivador tamaño carta',25],['Carpeta plástica con broche',8],['Notas adhesivas 100 hojas',10],['Grapadora mediana',32],['Grapas caja 5000 unidades',12]]],
 ['Libros y lectura',[['Libro para colorear animales',22],['Diccionario escolar español',65],['Libro de caligrafía inicial',28],['Cuentos infantiles ilustrados',55],['Atlas escolar ilustrado',85]]],
 ['Accesorios escolares',[['Estuche escolar con cierre',30],['Mochila escolar básica',145],['Lonchera escolar',75],['Calculadora básica',45],['Pizarra blanca pequeña',38]]]
];
async function main(){
 if(process.argv[2]!=='--cargar')throw Error('Usar --cargar para insertar datos ficticios');
 const c=await conectar();let server;
 try{
  const admins=await filas(c,"SELECT id_usuario FROM usuarios WHERE id_rol IN (1,3) AND estado='A' ORDER BY id_usuario");
  if(!admins.length)throw Error('Se requiere administrador existente');
  const admin=admins[0].ID_USUARIO;
  if(!state.products){
   const [counts]=await filas(c,'SELECT (SELECT COUNT(*) FROM productos)+(SELECT COUNT(*) FROM clientes)+(SELECT COUNT(*) FROM pedidos) n');
   if(counts.N)throw Error('La carga inicial requiere catálogo vacío para no mezclar conjuntos');
   const tables=await filas(c,"SELECT tablename FROM pg_tables WHERE schemaname='public'");const backup={fecha:new Date().toISOString(),tablas:{}};
   for(const {TABLENAME:t} of tables){const [r]=await filas(c,`SELECT COALESCE(json_agg(row_to_json(x)),'[]'::json)::text datos FROM "${t}" x`);backup.tablas[t]=JSON.parse(r.DATOS);}
   fs.mkdirSync(path.dirname(stateFile),{recursive:true});fs.writeFileSync(path.join(path.dirname(stateFile),`antes-demo-${Date.now()}.json`),JSON.stringify(backup));
   async function insert(table,pk,data){const keys=Object.keys(data);const r=await c.execute(`INSERT INTO ${table}(${keys.join(',')}) VALUES (${keys.map(k=>':'+k).join(',')}) RETURNING ${pk} INTO :id`,{...data,id:idSalida()});return r.outBinds.id[0];}
   state.products=[];state.clients=[];state.suppliers=[];state.employees=[];state.credentials=[];
   for(const [category,items] of groups){const cat=await insert('categorias','id_categoria',{nombre:category,descripcion:'Catálogo de demostración'});for(const [name,price] of items){const index=state.products.length;const id=await insert('productos','id_producto',{codigo:`DEMO-${String(index+1).padStart(3,'0')}`,nombre:name,descripcion:'Artículo de muestra para demostración; precio ficticio con IVA incluido.',precio:price,stock:0,stock_minimo:10,id_categoria:cat});state.products.push({id,price,group:Math.floor(index/10)});}}
   const first=['Ana','Carlos','María','José','Lucía','Miguel','Sofía','Diego','Valeria','Luis','Elena','Andrés','Paola','Daniel','Camila','Jorge','Isabel','Ricardo','Gabriela','Fernando'];
   const last=['Morales','López','Pérez','Hernández','Ramírez','Gómez','Castillo','Méndez','Vásquez','Reyes'];
   for(let i=0;i<20;i++)state.clients.push(await insert('clientes','id_cliente',{nombres:first[i],apellidos:last[i%10],nit:null,correo:`cliente${i+1}@example.invalid`,direccion:'Registro ficticio de demostración'}));
   for(const name of ['Distribuidora Papel y Color','Suministros Aula Creativa','Editorial Lectura Escolar','Mayorista Oficina Central'])state.suppliers.push(await insert('proveedores','id_proveedor',{nombre:name+' (Demo)',nit:`DEMO-P${state.suppliers.length+1}`,direccion:'Proveedor ficticio; documento no fiscal'}));
   for(const [i,name] of ['Andrea Solís','Mateo Rivas','Daniela Fuentes'].entries()){const password=randomBytes(15).toString('base64url');const user=`demo.caja${i+1}`;const id=await insert('usuarios','id_usuario',{nombre_completo:name+' (Demo)',nombre_usuario:user,contrasena_hash:await bcrypt.hash(password,10),id_rol:2,sueldo:3800+i*150,puesto:'Ventas y atención al cliente',horario:i===2?'Lunes a sábado, 12:00 a 18:00':'Lunes a sábado, 08:00 a 14:00'});state.employees.push(id);state.credentials.push({usuario:user,contrasena:password});}
   await c.execute("INSERT INTO rol_permiso(id_rol,id_permiso) SELECT 2,id_permiso FROM permisos WHERE codigo IN ('VENTAS_GESTIONAR','CLIENTES_VER','PRODUCTOS_VER','INVENTARIO_VER') ON CONFLICT DO NOTHING");
   await c.execute("INSERT INTO bitacora(id_usuario,accion,tabla_afectada,detalle) VALUES (:id,'CARGA_DEMO','SISTEMA','Catálogo y personal ficticios cargados por solicitud del propietario')",{id:admin});
   await c.commit();save();console.log('Catálogo: 40 productos, 20 clientes, 4 proveedores y 3 empleados.');
  }
  for(const [i,id] of state.clients.entries())await c.execute('UPDATE clientes SET nit=:nit WHERE id_cliente=:id AND nit IS NULL',{id,nit:nitDemo(9100000+i)});
  for(const [i,id] of state.suppliers.entries())await c.execute("UPDATE proveedores SET nit=:nit WHERE id_proveedor=:id AND nit LIKE 'DEMO-%'",{id,nit:nitDemo(9200000+i)});
  for(const id of state.employees)await c.execute("UPDATE usuarios SET nombre_completo=REPLACE(nombre_completo,' (Demo)',''),puesto='Ventas (demostración)' WHERE id_usuario=:id",{id});
  await c.execute("INSERT INTO rol_permiso(id_rol,id_permiso) SELECT 2,id_permiso FROM permisos WHERE codigo IN ('DESCUENTOS_APLICAR','PAGOS_REGISTRAR') ON CONFLICT DO NOTHING");await c.commit();
  server=require('../src/server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
  const tokens=new Map();
  async function req(url,body,user=admin){if(!tokens.has(user))tokens.set(user,jwt.sign({id:user},process.env.JWT_SECRET,{expiresIn:'1h'}));const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${tokens.get(user)}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(`${url}: ${r.status} ${JSON.stringify(data)}`);return data;}
  async function once(key,fn){if(state.done.includes(key))return;await fn();state.done.push(key);save();}
  const [date]=await filas(c,"SELECT TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') hoy");const today=date.HOY;
  for(const method of ['EFECTIVO','TRANSFERENCIA'])await once('opening-'+method,()=>req('/finanzas/movimientos',{clave:'demo-opening-'+method.toLowerCase()+'-v1',categoria:'SALDO_INICIAL',metodo:method,monto:method==='EFECTIVO'?15000:25000,fecha:today,concepto:'Saldo inicial de demostración'}));
  for(let i=0;i<4;i++)await once('purchase-'+i,()=>req('/compras',{idProveedor:state.suppliers[i],factura:`DEMO-COMPRA-${i+1}`,clave:`demo-compra-inicial-000${i}`,pago:i===3?null:{metodo:'TRANSFERENCIA',referencia:`DEMO-TR-${i+1}`},detalles:state.products.filter(p=>p.group===i).map(p=>({idProducto:p.id,cantidad:p===state.products[39]?5:100,costo:Math.round(p.price*0.6*100)/100}))}));
  async function order(i){await once('order-'+i,async()=>{
   const user=state.employees[i%3];const special=i>=56;const details=i===0?[{idProducto:state.products[36].id,cantidad:10}]:[{idProducto:state.products[(i*3)%39].id,cantidad:1+i%3},{idProducto:state.products[(i*3+7)%39].id,cantidad:1+i%2}];
   const p=await req('/pedidos',{idCliente:i===0||i===1?state.clients[0]:i%5===0?null:state.clients[i%20],descuento:special&&(i%3===0||i===56)?20:i%11===0?15:i%7===0?5:0,clave:`demo-pedido-libreria-${String(i).padStart(4,'0')}`,detalles:details},user);const id=p.ID_PEDIDO;p.estado=p.estado||p.ESTADO;p.total=p.total??p.TOTAL;
   if(p.estado==='PENDIENTE_APROBACION'){if(i===57||i===60||i===63)return;await req(`/pedidos/${id}/decision`,{decision:i===56?'RECHAZADO':'APROBADO',motivo:'Demostración: descuento por compra de útiles escolares'},admin);if(i===56)return;}
   if(i===58){await req(`/pedidos/${id}/cancelar`,{},user);return;}
   if(i===59)return;
   await req(`/pedidos/${id}/venta`,{},user);
   const total=p.total;const points=i===1?100:0;const due=Math.round((total-points/10)*100)/100;
   const method=['EFECTIVO','TARJETA','TRANSFERENCIA'][i%3];
   if(i===61||i%9===0){const part=Math.floor(due*50)/100;await req(`/pedidos/${id}/pagos`,{clave:`demo-pago-parcial-000${i}`,monto:part,metodo:'EFECTIVO'},user);if(i===61)return;await req(`/pedidos/${id}/pagos`,{clave:`demo-pago-final-000${i}`,monto:Math.round((due-part)*100)/100,metodo:'TARJETA',referencia:`DEMO-PAGO-${i}`,puntos:points},user);}
   else await req(`/pedidos/${id}/pagos`,{clave:`demo-pago-completo-000${i}`,monto:due,metodo:method,referencia:method==='EFECTIVO'?null:`DEMO-PAGO-${i}`,puntos:points},user);
   if(i%10===0)console.log(`Ventas procesadas: ${i+1}`);
  });}
  await order(0);await order(1);
  for(let start=2;start<64;start+=4){const results=await Promise.allSettled(Array.from({length:Math.min(4,64-start)},(_,n)=>order(start+n)));const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;console.log(`Pedidos preparados: ${Math.min(start+4,64)}/64`);}
  for(const [i,[concept,amount,method]] of [['Alquiler del local',2800,'TRANSFERENCIA'],['Servicio de energía eléctrica',245,'TRANSFERENCIA'],['Insumos de limpieza',135,'EFECTIVO'],['Transporte de mercadería',180,'EFECTIVO'],['Servicio de internet',275,'TRANSFERENCIA'],['Papelería de uso interno',85,'EFECTIVO']].entries())await once('expense-'+i,()=>req('/finanzas/movimientos',{clave:`demo-gasto-libreria-000${i}`,categoria:'GASTO',metodo:method,monto:amount,fecha:today,concepto:`${concept} (demostración)`,referencia:`DEMO-GASTO-${i}`}));
  console.log(await filas(c,"SELECT estado,COUNT(*) cantidad FROM pedidos GROUP BY estado ORDER BY estado"));
  const bad=await filas(c,"SELECT p.codigo FROM productos p WHERE p.codigo LIKE 'DEMO-%' AND p.stock<>COALESCE((SELECT SUM(CASE WHEN m.tipo='SALIDA_VENTA' THEN -m.cantidad ELSE m.cantidad END) FROM movimientos_inventario m WHERE m.id_producto=p.id_producto),0)");if(bad.length)throw Error('Inventario no conciliado');
  console.log('Carga finalizada. Inventario conciliado. Credenciales demo guardadas en respaldo local privado.');
 }finally{await c.close();if(server)await new Promise(r=>server.close(r));await driver.cerrarPool();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

