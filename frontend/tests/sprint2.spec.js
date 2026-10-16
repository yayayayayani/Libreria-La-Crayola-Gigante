import {test,expect} from '@playwright/test';
async function iniciar(page, permisos=['PROVEEDORES_GESTIONAR','COMPRAS_GESTIONAR','INVENTARIO_VER','INVENTARIO_GESTIONAR']) {
 const estado={stock:2,compra:null,peticiones:[]};
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.replace('/api','');estado.peticiones.push(`${req.method()} ${path}`);
  const ok=(json,status=200)=>route.fulfill({json,status});
  if(path==='/auth/login')return ok({token:'prueba',usuario:{id:1,nombre:'Prueba',rol:'Administrador'}});
  if(path==='/auth/permisos')return ok({permisos,usuario:{id:1,idRol:1,nombre:'Prueba',rol:'Administrador'}});
  if(path==='/proveedores')return ok([{ID_PROVEEDOR:1,NOMBRE:'Distribuidora',NIT:'1234567K',ESTADO:'A'}]);
  if(path==='/catalogo-compras')return ok([{ID_PRODUCTO:1,NOMBRE:'Cuaderno',CODIGO:'C1'}]);
  if(path==='/compras' && req.method()==='POST'){estado.compra=req.postDataJSON();return ok({id:7,mensaje:'Compra recibida e inventario actualizado'},201);}
  if(path==='/compras')return ok([]);
  if(path==='/inventario')return ok([{ID_PRODUCTO:1,NOMBRE:'Cuaderno',CODIGO:'C1',STOCK:estado.stock,STOCK_MINIMO:3,ESTADO:'A',ALERTA:estado.stock<=3?1:0}]);
  if(path==='/movimientos')return ok([]);
  if(path==='/usuarios/roles-asignables')return ok([{ID_ROL:1,NOMBRE:'Administrador'}]);
  if(path==='/usuarios' && req.method()==='POST')return ok({mensaje:'El correo ya está registrado. No se puede asignar a otra cuenta.'},409);
  if(path==='/usuarios')return ok([]);
  return ok({mensaje:'Ruta no simulada'},404);
 });
 await page.goto('/');await page.locator('#usuario').fill('prueba');await page.locator('#contrasena').fill('prueba');await page.getByRole('button',{name:'Iniciar sesión'}).click();
 return estado;
}
test('compra completa envía detalle y muestra confirmación',async({page})=>{
 const estado=await iniciar(page);await page.getByRole('button',{name:/^Compras e inventario/}).click();await page.getByRole('button',{name:'Compras',exact:true}).click();
  await page.getByRole('combobox',{name:'Proveedor',exact:true}).selectOption('1');await page.getByLabel('Serie y número de factura').fill('A-1');await page.getByRole('combobox',{name:'Producto 1',exact:true}).selectOption('1');await page.getByLabel('Cantidad',{exact:true}).fill('4');await page.getByLabel('Costo unitario (Q)').fill('2.50');
 await page.getByRole('button',{name:'Confirmar recepción y registrar compra'}).click();await expect(page.getByText('Compra recibida e inventario actualizado. Compra #7')).toBeVisible();
 expect(estado.compra.detalles).toEqual([{idProducto:1,cantidad:4,costo:2.5}]);expect(estado.compra.clave).toHaveLength(32);
});
test('inventario actualiza cambios de otro usuario y resuelve alerta',async({page})=>{
 const estado=await iniciar(page,['INVENTARIO_VER']);await page.getByRole('button',{name:/^Compras e inventario/}).click();
 await expect(page.getByText('1 productos activos en su mínimo o por debajo.')).toBeVisible();estado.stock=10;
 await expect(page.getByText('0 productos activos en su mínimo o por debajo.')).toBeVisible({timeout:8000});
 await expect(page.getByRole('cell',{name:'10',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar',exact:true})).toHaveCount(0);
});
test('permiso de consulta oculta compras y proveedores',async({page})=>{
 const estado=await iniciar(page,['INVENTARIO_VER']);await page.getByRole('button',{name:/^Compras e inventario/}).click();
 await expect(page.getByRole('button',{name:'Compras',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Proveedores',exact:true})).toHaveCount(0);
 expect(estado.peticiones).not.toContain('GET /compras');expect(estado.peticiones).not.toContain('GET /proveedores');
});
test('formulario bloquea nombre numérico antes de enviar',async({page})=>{
 const estado=await iniciar(page,['USUARIOS_GESTIONAR']);await page.getByRole('button',{name:/^Usuarios /}).click();await page.getByRole('button',{name:'Nuevo usuario'}).click();
 await page.getByLabel('Nombre completo').fill('Pedro123');await page.getByLabel('Nombre de usuario').fill('pedro');await page.getByLabel('Contraseña',{exact:true}).fill('Prueba12345');await page.getByLabel('Correo electrónico').fill('prueba@example.invalid');await page.getByRole('button',{name:'Guardar',exact:true}).click();
 expect(await page.getByLabel('Nombre completo').evaluate(e=>e.validity.patternMismatch)).toBe(true);expect(estado.peticiones).not.toContain('POST /usuarios');
});
test('correo duplicado muestra aviso y conserva el formulario',async({page})=>{
 await iniciar(page,['USUARIOS_GESTIONAR']);await page.getByRole('button',{name:/^Usuarios /}).click();await page.getByRole('button',{name:'Nuevo usuario'}).click();
 await page.getByLabel('Nombre completo').fill('Pedro Pérez');await page.getByLabel('Nombre de usuario').fill('pedro');await page.getByLabel('Contraseña',{exact:true}).fill('Prueba12345');await page.getByLabel('Correo electrónico').fill('prueba@example.invalid');await page.getByRole('button',{name:'Guardar',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('El correo ya está registrado');await expect(page.getByLabel('Correo electrónico')).toHaveValue('prueba@example.invalid');
});
