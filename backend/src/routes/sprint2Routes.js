const router = require('express').Router();
const { verificarToken } = require('../middlewares/authMiddleware');
const { verificarPermiso } = require('../middlewares/permisosMiddleware');
const { conectar, filas, idSalida } = require('../services/db');
const { exigir, entero, correoValido, nitValido, validarCompra } = require('../services/validaciones');
router.use(verificarToken);
const permiso = verificarPermiso;
function endpoint(fn) {
  return async (req,res) => {
    let c;
    try { c = await conectar(); await fn(req,res,c); }
    catch(e) {
      if(c) await c.rollback();
      const status = e.status || (e.errorNum === 1 ? 409 : 500);
      if(status === 500) console.error('Sprint 2:',e.code || e.name);
      res.status(status).json({ mensaje: e.status ? e.message : status === 409 ? 'El registro ya existe: revisa NIT, factura o clave de operación.' : 'No se pudo completar la operación' });
    } finally { if(c) await c.close(); }
  };
}
router.get('/proveedores', permiso(['PROVEEDORES_GESTIONAR','COMPRAS_GESTIONAR']), endpoint(async(req,res,c)=> {
  res.json(await filas(c,'SELECT * FROM proveedores ORDER BY nombre'));
}));
function proveedor(body) {
  exigir(typeof body.nombre === 'string' && body.nombre.trim().length > 1 && body.nombre.trim().length <= 150,'Nombre comercial obligatorio (2 a 150 caracteres)');
  const nit = typeof body.nit === 'string' ? body.nit.trim().toUpperCase().replace('-','') : '';
  exigir(nitValido(nit),'NIT inválido: usa NIT tradicional o identificador de 13 dígitos');
  const correo = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : null;
  exigir(!correo || correoValido(correo),'Correo inválido');
  exigir(!body.telefono || (typeof body.telefono === 'string' && /^[+0-9 ()-]{8,25}$/.test(body.telefono)), 'Teléfono inválido');
  exigir(!body.direccion || (typeof body.direccion === 'string' && body.direccion.length <= 250),'Dirección demasiado larga');
  return { nombre: body.nombre.trim(), nit, correo: correo || null, telefono: body.telefono || null, direccion: body.direccion || null };
}
router.post('/proveedores', permiso('PROVEEDORES_GESTIONAR'), endpoint(async(req,res,c)=> {
  const datos = proveedor(req.body || {});
  await c.execute('INSERT INTO proveedores(nombre,nit,correo,telefono,direccion) VALUES (:nombre,:nit,:correo,:telefono,:direccion)', datos);
  await c.commit(); res.status(201).json({mensaje:'Proveedor registrado'});
}));
router.put('/proveedores/:id', permiso('PROVEEDORES_GESTIONAR'), endpoint(async(req,res,c)=> {
  const id = Number(req.params.id); exigir(entero(id),'ID inválido');
  const datos = proveedor(req.body || {});
  exigir(['A','I'].includes(req.body.estado),'Estado inválido');
  const r = await c.execute('UPDATE proveedores SET nombre=:nombre,nit=:nit,correo=:correo,telefono=:telefono,direccion=:direccion,estado=:estado WHERE id_proveedor=:id', {...datos,estado:req.body.estado,id});
  exigir(r.rowsAffected,'Proveedor no encontrado',404); await c.commit(); res.json({mensaje:'Proveedor actualizado'});
}));
router.get('/compras', permiso('COMPRAS_GESTIONAR'), endpoint(async(req,res,c)=> {
  res.json(await filas(c,`SELECT c.*,p.nombre proveedor,r.id_recepcion,r.fecha fecha_recepcion FROM compras c JOIN proveedores p ON p.id_proveedor=c.id_proveedor JOIN recepciones r ON r.id_compra=c.id_compra ORDER BY c.id_compra DESC`));
}));
router.get('/compras/:id', permiso('COMPRAS_GESTIONAR'), endpoint(async(req,res,c)=> {
  const id = Number(req.params.id); exigir(entero(id),'ID inválido');
  const compras = await filas(c,'SELECT * FROM compras WHERE id_compra=:id',{id});
  exigir(compras.length,'Compra no encontrada',404);
  res.json({compra:compras[0],detalles:await filas(c,`SELECT d.*,p.nombre FROM detalle_compras d JOIN productos p ON p.id_producto=d.id_producto WHERE d.id_compra=:id`,{id}),recepcion:(await filas(c,'SELECT * FROM recepciones WHERE id_compra=:id',{id}))[0]});
}));
router.get('/catalogo-compras', permiso('COMPRAS_GESTIONAR'), endpoint(async(req,res,c)=> {
  res.json(await filas(c,"SELECT id_producto,codigo,nombre FROM productos WHERE estado='A' ORDER BY nombre"));
}));
router.post('/compras', permiso('COMPRAS_GESTIONAR'), endpoint(async(req,res,c)=> {
  const datos = validarCompra(req.body || {});
  // Clave única y factura única impiden entradas duplicadas ante reintentos.
  const prov = await filas(c,"SELECT id_proveedor FROM proveedores WHERE id_proveedor=:id AND estado='A' FOR UPDATE",{id:datos.idProveedor});
  exigir(prov.length,'El proveedor no existe o está inactivo');
  const saldos = new Map();
  for (const d of datos.detalles) {
    const ps = await filas(c,"SELECT stock FROM productos WHERE id_producto=:id AND estado='A' FOR UPDATE",{id:d.idProducto});
    exigir(ps.length,'Un producto no existe o está inactivo');
    exigir(ps[0].STOCK + d.cantidad <= 9999999999,'La existencia supera el límite permitido');
    saldos.set(d.idProducto,ps[0].STOCK);
  }
  const r = await c.execute(`INSERT INTO compras(id_proveedor,id_usuario,factura,clave,total) VALUES (:proveedor,:usuario,:factura,:clave,:total) RETURNING id_compra INTO :id`,{proveedor:datos.idProveedor,usuario:req.usuario.ID_USUARIO,factura:datos.factura,clave:datos.clave,total:datos.total,id:idSalida()});
  const id = r.outBinds.id[0];
  const recepcion = await c.execute('INSERT INTO recepciones(id_compra,id_usuario) VALUES (:id,:usuario) RETURNING id_recepcion INTO :recepcion',{id,usuario:req.usuario.ID_USUARIO,recepcion:idSalida()});
  for(const d of datos.detalles) {
    await c.execute('INSERT INTO detalle_compras(id_compra,id_producto,cantidad,costo) VALUES (:id,:idProducto,:cantidad,:costo)',{id,...d});
    await c.execute('UPDATE productos SET stock=stock+:cantidad WHERE id_producto=:idProducto',{cantidad:d.cantidad,idProducto:d.idProducto});
    await c.execute(`INSERT INTO movimientos_inventario(id_producto,id_recepcion,id_usuario,tipo,cantidad,stock_anterior,stock_nuevo) VALUES (:producto,:recepcion,:usuario,'ENTRADA_COMPRA',:cantidad,:anterior,:nuevo)`,{producto:d.idProducto,recepcion:recepcion.outBinds.recepcion[0],usuario:req.usuario.ID_USUARIO,cantidad:d.cantidad,anterior:saldos.get(d.idProducto),nuevo:saldos.get(d.idProducto)+d.cantidad});
  }
  await c.commit(); res.status(201).json({id,mensaje:'Compra recibida e inventario actualizado',total:datos.total});
}));
router.get('/inventario', permiso(['INVENTARIO_VER','INVENTARIO_GESTIONAR']), endpoint(async(req,res,c)=> {
  res.json(await filas(c,`SELECT id_producto,codigo,nombre,stock,stock_minimo,estado, CASE WHEN stock <= stock_minimo AND estado='A' THEN 1 ELSE 0 END alerta FROM productos ORDER BY nombre`));
}));
router.get('/movimientos', permiso('INVENTARIO_VER'), endpoint(async(req,res,c)=> {
  res.json(await filas(c,`SELECT m.*,p.nombre,r.id_compra FROM movimientos_inventario m JOIN productos p ON p.id_producto=m.id_producto LEFT JOIN recepciones r ON r.id_recepcion=m.id_recepcion ORDER BY m.id_movimiento DESC`));
}));
router.patch('/inventario/:id/minimo', permiso('INVENTARIO_GESTIONAR'), endpoint(async(req,res,c)=> {
  const id = Number(req.params.id), minimo = req.body?.minimo;
  exigir(entero(id) && entero(minimo,0),'El mínimo debe ser un entero no negativo');
  const r = await c.execute('UPDATE productos SET stock_minimo=:minimo WHERE id_producto=:id',{minimo,id});
  exigir(r.rowsAffected,'Producto no encontrado',404); await c.commit(); res.json({mensaje:'Nivel mínimo actualizado'});
}));
module.exports = router;
