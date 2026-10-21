import { test, expect } from '@playwright/test';
async function iniciar(page, empleado=false) {
  const estado={cliente:null,compra:null,fallar:false};
  await page.route('**/api/**',async route=>{
    const r=route.request(),p=new URL(r.url()).pathname.replace('/api','');
    const ok=(json,status=200)=>route.fulfill({json,status});
    if(p==='/auth/login')return ok({token:'test',usuario:{nombre:'Ana'}});
    if(p==='/auth/permisos')return ok({usuario:{id:2,idRol:empleado?2:1,rol:empleado?'Empleado':'Administrador'},permisos:['CLIENTES_VER','CLIENTES_CREAR','CLIENTES_EDITAR','COMPRAS_GESTIONAR','PROVEEDORES_GESTIONAR','INVENTARIO_VER','VENTAS_GESTIONAR']});
    if(p==='/finanzas/resumen')return ok({totales:{INGRESOS:200,EGRESOS:estado.compra?25:0,BALANCE:estado.compra?175:200,SALDO:estado.compra?675:700,SALDO_ANTERIOR:500,APERTURAS:0},porMetodo:[],porDia:[],movimientos:[],totalMovimientos:0});
    if(p==='/finanzas/compras-pendientes')return ok([]);
    if(p==='/empleado/mi-carnet')return ok({empleado:{ID_USUARIO:2,NOMBRE_COMPLETO:'Ana Lopez',NOMBRE_USUARIO:'ana',CORREO:'ana@example.invalid',SUELDO:3500,HORARIO:'Lunes a viernes, 8:00 a 17:00',PUESTO:'Cajera'},resumen:{VENTAS:5,TOTAL:450},ventas:[{ID_VENTA:1,CLIENTE_NOMBRE:'CF',TOTAL:90,ESTADO:'PAGADO'}]});
    if(p==='/clientes'&&r.method()==='POST'){
      if(estado.fallar)return ok({mensaje:'No se pudo guardar el cliente'},500);
      estado.cliente=r.postDataJSON();return ok({mensaje:'Cliente guardado'},201);
    }
    if(p==='/clientes')return ok([]);
    if(p==='/proveedores')return ok([{ID_PROVEEDOR:1,NOMBRE:'Proveedor Uno',NIT:'1234567',ESTADO:'A'}]);
    if(p==='/catalogo-compras')return ok([{ID_PRODUCTO:1,CODIGO:'A1',NOMBRE:'Cuaderno'}]);
    if(p==='/compras'&&r.method()==='POST'){estado.compra=r.postDataJSON();return ok({id:1,mensaje:'Compra guardada'},201);}
    if(p==='/compras'||p==='/inventario'||p==='/movimientos')return ok([]);
    if(p==='/ventas/catalogo')return ok({clientes:[],productos:[{ID_PRODUCTO:1,NOMBRE:'Cuaderno',PRECIO:12.5,STOCK:10}]});
    if(p==='/pedidos')return ok([]);
    return ok({mensaje:'Ruta no simulada'},404);
  });
  await page.goto('/');await page.locator('#usuario').fill('ana');await page.locator('#contrasena').fill('prueba');await page.getByRole('button',{name:/Iniciar sesi/}).click();
  await expect(page.getByRole('button',{name:/^Clientes/})).toBeVisible();return estado;
}
test('salir sin guardar descarta y guardar y salir registra el cliente',async({page})=>{
  const e=await iniciar(page);
  await page.getByRole('button',{name:/^Clientes/}).click();await page.getByRole('button',{name:'Nuevo cliente'}).click();await page.getByLabel('Nombres',{exact:true}).fill('Ana');
  await page.getByRole('button',{name:/Volver al/}).click();await expect(page.getByRole('alertdialog')).toBeVisible();await page.getByRole('button',{name:'Seguir editando'}).click();await expect(page.getByLabel('Nombres',{exact:true})).toHaveValue('Ana');
  await page.getByRole('button',{name:/Volver al/}).click();await page.getByRole('button',{name:'Salir sin guardar'}).click();expect(e.cliente).toBeNull();
  await page.getByRole('button',{name:/^Clientes/}).click();await page.getByRole('button',{name:'Nuevo cliente'}).click();await page.getByLabel('Nombres',{exact:true}).fill('Julia');
  await page.getByRole('button',{name:/Volver al/}).click();await page.getByRole('button',{name:'Guardar y salir'}).click();await expect(page.getByRole('button',{name:/^Clientes/})).toBeVisible();expect(e.cliente.nombres).toBe('Julia');
});
test('error al guardar impide salir y conserva datos',async({page})=>{
  const e=await iniciar(page);e.fallar=true;
  await page.getByRole('button',{name:/^Clientes/}).click();await page.getByRole('button',{name:'Nuevo cliente'}).click();await page.getByLabel('Nombres',{exact:true}).fill('Ana');
  await page.getByRole('button',{name:/Volver al/}).click();await page.getByRole('button',{name:'Guardar y salir'}).click();await expect(page.getByRole('alert')).toContainText('No se pudo guardar');await expect(page.getByLabel('Nombres',{exact:true})).toHaveValue('Ana');
});
test('compra pagada se registra con metodo y actualiza saldo',async({page})=>{
  const e=await iniciar(page);await expect(page.getByText('Saldo disponible',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/^Compras e inventario/}).click();
  await page.getByRole('combobox',{name:'Proveedor',exact:true}).selectOption('1');await page.getByLabel(/Serie y/).fill('A-1');await page.getByRole('combobox',{name:'Producto 1',exact:true}).selectOption('1');await page.getByLabel('Cantidad',{exact:true}).fill('2');await page.getByLabel('Costo unitario (Q)',{exact:true}).fill('12.50');
  await page.getByRole('button',{name:/Confirmar recepci/}).click();await expect(page.getByRole('status')).toContainText('Compra guardada');expect(e.compra.pago.metodo).toBe('EFECTIVO');
  await page.getByRole('button',{name:/Volver al/}).click();await expect(page.getByRole('alertdialog')).toHaveCount(0);await expect(page.getByText('Q 675.00',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/dashboard-ordenado.png',fullPage:true});
});
test('carnet muestra solo datos propios y ventas',async({page})=>{
  await iniciar(page,true);const carnet=page.getByRole('region',{name:'Mi carnet'});await expect(carnet.getByText('Ana Lopez',{exact:true})).toBeVisible();await expect(carnet).toContainText('3,500.00');await expect(carnet).toContainText('Lunes a viernes');await carnet.getByText('Mis últimas ventas',{exact:true}).click();await expect(carnet.getByRole('cell',{name:'PAGADO'})).toBeVisible();await expect(page.getByRole('region',{name:'Finanzas de administración'})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/carnet-mobile.png',fullPage:true});
});
test('cambiar de pestaña ofrece guardar y descarta el carrito si se elige salir',async({page})=>{
  await iniciar(page);await page.getByRole('button',{name:/^Ventas a clientes/}).click();await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption('1');await page.getByRole('button',{name:'Historial',exact:true}).click();await expect(page.getByRole('alertdialog')).toBeVisible();await page.getByRole('button',{name:'Salir sin guardar'}).click();await page.getByRole('button',{name:'Nueva venta',exact:true}).click();await expect(page.getByRole('combobox',{name:'Producto',exact:true})).toHaveValue('');
});

test('agregar filas sin escribir tambien activa el aviso y permite volver con Escape',async({page})=>{
  await iniciar(page);
  await page.getByRole('button',{name:/^Ventas a clientes/}).click();
  await page.getByRole('button',{name:'Agregar producto'}).click();
  await page.getByRole('button',{name:'Historial',exact:true}).click();
  const aviso=page.getByRole('alertdialog');
  await expect(aviso).toBeVisible();
  await expect(aviso.getByRole('button',{name:'Seguir editando'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(aviso).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Producto',exact:true})).toHaveCount(2);
  await page.getByRole('button',{name:'Historial',exact:true}).click();
  await aviso.getByRole('button',{name:'Salir sin guardar'}).click();
  await page.getByRole('button',{name:'Nueva venta',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Producto',exact:true})).toHaveCount(1);
});
