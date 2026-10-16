// Navegador real -> Express -> Neon. Solo borra los registros propios de prueba.
require('dotenv').config({quiet:true});
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const bcrypt=require('bcryptjs');
const {chromium}=require('../../frontend/node_modules/playwright');
const {conectar,filas,idSalida}=require('../src/services/db');
const {cerrarPool}=require('../src/config/driver');
const app=require('../src/server');
async function main(){
 let c,server,browser,usuario,usuarioDos,categoria,producto,proveedor;
 const marca='E2E_'+Date.now(),password=randomUUID();
 try{
  c=await conectar();
  const insert=async(sql,b={})=>(await c.execute(sql,{...b,id:idSalida()})).outBinds.id[0];
  const hash=await bcrypt.hash(password,4);
  for(let i=0;i<2;i++){
   const id=await insert("INSERT INTO usuarios(nombre_completo,nombre_usuario,contrasena_hash,id_rol) VALUES ('Prueba Navegador',:nombre,:hash,1) RETURNING id_usuario INTO :id",{nombre:marca+'_'+i,hash});
   if(i===0)usuario=id;else usuarioDos=id;
  }
  categoria=await insert('INSERT INTO categorias(nombre) VALUES (:nombre) RETURNING id_categoria INTO :id',{nombre:marca});
  producto=await insert("INSERT INTO productos(codigo,nombre,precio,stock,stock_minimo,id_categoria) VALUES (:codigo,'Cuaderno de prueba',5,2,3,:categoria) RETURNING id_producto INTO :id",{codigo:marca,categoria});
  proveedor=await insert('INSERT INTO proveedores(nombre,nit) VALUES (:nombre,:nit) RETURNING id_proveedor INTO :id',{nombre:marca,nit:String(Date.now())});
  await c.commit();
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});
  const pages=[];
  for(let i=0;i<2;i++){
   const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(30000);
   await page.goto(base);await page.locator('#usuario').fill(marca+'_'+i);await page.locator('#contrasena').fill(password);
   await page.getByRole('button',{name:'Iniciar sesión'}).click();await page.getByRole('button',{name:/^Compras e inventario/}).click();pages.push(page);
  }
  const [comprador,consulta]=pages;
  await consulta.getByRole('button',{name:'Inventario',exact:true}).click();
  await consulta.getByRole('row').filter({hasText:marca}).getByRole('cell',{name:'Reponer',exact:true}).waitFor();
  // Carga real desde React y lectura desde la otra sesión ya abierta.
  await comprador.getByRole('button',{name:'Volver al menú'}).click();
  await comprador.getByRole('button',{name:/^Productos /}).click();
  await comprador.getByRole('textbox',{name:'Buscar productos'}).fill(marca);
  await comprador.getByRole('row').filter({hasText:marca}).getByRole('button',{name:'Editar producto'}).click();
  const foto=await require('sharp')({create:{width:160,height:160,channels:3,background:'#d9a84b'}}).png().toBuffer();
  await comprador.getByLabel('Seleccionar imagen').setInputFiles({name:'prueba.png',mimeType:'image/png',buffer:foto});
  await comprador.getByAltText('Vista previa del producto').waitFor();
  await comprador.getByRole('button',{name:'Guardar',exact:true}).click();
  await comprador.getByRole('status').filter({hasText:'Producto actualizado'}).waitFor();
  await consulta.getByRole('row').filter({hasText:marca}).getByAltText('Cuaderno de prueba',{exact:true}).waitFor();
  await comprador.getByRole('button',{name:'Volver al menú'}).click();
  await comprador.getByRole('button',{name:/^Compras e inventario/}).click();
  await comprador.getByRole('button',{name:'Compras',exact:true}).click();
  await comprador.getByRole('combobox',{name:'Proveedor',exact:true}).selectOption(String(proveedor));
  await comprador.getByLabel('Serie y número de factura').fill(marca);
  await comprador.getByRole('combobox',{name:'Producto 1',exact:true}).selectOption(String(producto));
  await comprador.getByLabel('Cantidad',{exact:true}).fill('3');await comprador.getByLabel('Costo unitario (Q)').fill('2.50');
  await comprador.getByRole('button',{name:'Confirmar recepción y registrar compra'}).click();
  await comprador.getByText(/Compra recibida e inventario actualizado\. Compra #/).waitFor();
  await consulta.getByRole('row').filter({hasText:marca}).getByRole('cell',{name:'Disponible',exact:true}).waitFor();
  const saldo=(await filas(c,'SELECT stock FROM productos WHERE id_producto=:id',{id:producto}))[0].STOCK;
  assert.equal(saldo,5);
  const mov=await filas(c,"SELECT cantidad,stock_anterior,stock_nuevo FROM movimientos_inventario WHERE id_producto=:id AND tipo='ENTRADA_COMPRA'",{id:producto});
  assert.equal(mov.length,1);assert.deepEqual(mov[0],{CANTIDAD:3,STOCK_ANTERIOR:2,STOCK_NUEVO:5});
  console.log('APROBADO: login real de dos usuarios, fotografía subida desde React y visible en otra sesión, compra, recepción y movimiento en Neon, actualización automática en el segundo navegador.');
 }finally{
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
  if(c){
   await c.rollback();
   await c.execute('DELETE FROM movimientos_inventario WHERE id_producto=:id',{id:producto||-1});
   await c.execute('DELETE FROM detalle_compras WHERE id_compra IN (SELECT id_compra FROM compras WHERE id_proveedor=:id)',{id:proveedor||-1});
   await c.execute('DELETE FROM recepciones WHERE id_compra IN (SELECT id_compra FROM compras WHERE id_proveedor=:id)',{id:proveedor||-1});
   await c.execute('DELETE FROM compras WHERE id_proveedor=:id',{id:proveedor||-1});
   await c.execute('DELETE FROM proveedores WHERE id_proveedor=:id',{id:proveedor||-1});
   await c.execute('DELETE FROM productos WHERE id_producto=:id',{id:producto||-1});
   await c.execute('DELETE FROM categorias WHERE id_categoria=:id',{id:categoria||-1});
   await c.execute('DELETE FROM usuarios WHERE id_usuario IN (:a,:b)',{a:usuario||-1,b:usuarioDos||-1});
   await c.commit();await c.close();
  }
  await cerrarPool();
 }
}
main().catch(e=>{console.error('Prueba de navegador falló:',e.code||e.message);process.exitCode=1;});
