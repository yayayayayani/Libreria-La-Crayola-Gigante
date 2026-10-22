require('dotenv').config({quiet:true});
const fs=require('node:fs'),path=require('node:path'),jwt=require('jsonwebtoken');
const {chromium}=require('../../frontend/node_modules/@playwright/test');
const {conectar,filas}=require('../src/services/db');
const driver=require('../src/config/driver');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const c=await conectar();let server,browser;
 try{
 const state=JSON.parse(fs.readFileSync(path.join(root,'.migration-backups/demo-libreria-v1.json'),'utf8'));
 const [admin]=await filas(c,"SELECT id_usuario FROM usuarios WHERE id_rol IN (1,3) AND estado='A' ORDER BY id_usuario LIMIT 1");
 const report={};for(const t of ['categorias','productos','clientes','proveedores','compras','pedidos','ventas','pagos','comprobantes','movimientos_inventario','movimientos_puntos','movimientos_financieros']){const [r]=await filas(c,`SELECT COUNT(*) n FROM ${t}`);report[t]=r.N;}
 const [stock]=await filas(c,"SELECT COUNT(*) n FROM productos p WHERE p.stock<>COALESCE((SELECT SUM(CASE WHEN tipo='SALIDA_VENTA' THEN -cantidad ELSE cantidad END) FROM movimientos_inventario m WHERE m.id_producto=p.id_producto),0)");
 const [points]=await filas(c,'SELECT COUNT(*) n FROM clientes c WHERE c.puntos<>COALESCE((SELECT SUM(puntos) FROM movimientos_puntos m WHERE m.id_cliente=c.id_cliente),0)');
 const [payments]=await filas(c,"SELECT COUNT(*) n FROM ventas v JOIN pedidos p ON p.id_pedido=v.id_pedido WHERE p.estado='PAGADO' AND v.total<>COALESCE((SELECT SUM(monto) FROM pagos g WHERE g.id_venta=v.id_venta),0)");
 if(stock.N||points.N||payments.N)throw Error('Fallo de conciliación');
 report['Diferencias de inventario']=stock.N;report['Diferencias de puntos']=points.N;report['Diferencias en ventas pagadas']=payments.N;
 fs.writeFileSync(path.join(root,'scripts/documentacion/resultado_carga.json'),JSON.stringify(report,null,2));console.log(report);
 server=require('../src/server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 browser=await chromium.launch({channel:'msedge',headless:true});
 const dir=path.join(root,'scripts/documentacion/capturas');fs.mkdirSync(dir,{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
 const base=`http://127.0.0.1:${server.address().port}`;
 async function open(screen,user=admin.ID_USUARIO){
  const token=jwt.sign({id:user},process.env.JWT_SECRET,{expiresIn:'15m'});
  await page.goto(base);await page.evaluate(({token,screen})=>{sessionStorage.setItem('crayola.sesion',JSON.stringify({token}));sessionStorage.setItem('crayola.pagina',screen);},{token,screen});
  await page.reload();
  await page.waitForLoadState('networkidle');
 }
 async function shot(name){await page.screenshot({path:path.join(dir,name+'.png'),fullPage:false});console.log('Captura '+name);}
 await open('dashboard');await shot('dashboard');
 await open('productos');await shot('productos');
 await open('clientes');await shot('clientes');
 await open('ventas');await page.getByRole('button',{name:'Historial',exact:true}).click();await shot('pedidos');
 await page.getByRole('button',{name:'Reportes',exact:true}).click();await page.getByRole('button',{name:'Ventas por día',exact:true}).click();await page.waitForLoadState('networkidle');await shot('reportes');
 await page.getByRole('button',{name:'Historial',exact:true}).click();await page.getByRole('button',{name:'Consultar comprobantes de ventas pagadas'}).click();await page.waitForLoadState('networkidle');await shot('comprobantes');
 await open('compras');const inv=page.getByRole('button',{name:'Inventario',exact:true});if(await inv.count())await inv.click();await page.waitForLoadState('networkidle');await shot('inventario');
 await open('dashboard',state.employees[0]);await shot('empleado');
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await c.close();await driver.cerrarPool();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
