const router = require("express").Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const { verificarPermiso } = require("../middlewares/permisosMiddleware");
const { conectar, filas, idSalida } = require("../services/db");
const { resumenRecuperaciones, validarRecuperacion, centavos } = require("../services/recuperaciones");
const {
  exigir,
  entero,
  normalizarTelefono,
  correoValido,
  documentoValido,
  validarCompra,
} = require("../services/validaciones");
router.use(verificarToken);
const permiso = verificarPermiso;
function endpoint(fn) {
  return async (req, res) => {
    let c;
    try {
      c = await conectar();
      await fn(req, res, c);
    } catch (e) {
      if (c) await c.rollback();
      const status = e.status || (e.errorNum === 1 ? 409 : 500);
      if (status === 500) console.error("Sprint 2:", e.code || e.name);
      res.status(status).json({
        mensaje: e.status
          ? e.message
          : status === 409
            ? "El registro ya existe: revisa NIT, factura o clave de operación."
            : "No se pudo completar la operación",
      });
    } finally {
      if (c) await c.close();
    }
  };
}
router.get(
  "/proveedores",
  permiso(["PROVEEDORES_GESTIONAR", "COMPRAS_GESTIONAR"]),
  endpoint(async (req, res, c) => {
    res.json(
      await filas(
        c,
        "SELECT p.*, (SELECT COUNT(*) FROM compras c WHERE c.id_proveedor=p.id_proveedor) compras_registradas FROM proveedores p ORDER BY LOWER(p.nombre),p.id_proveedor",
      ),
    );
  }),
);
function proveedor(body) {
  exigir(
    typeof body.nombre === "string" &&
      body.nombre.trim().length > 0 &&
      body.nombre.trim().length <= 150,
    "Nombre comercial obligatorio (1 a 150 caracteres)",
  );
  const nit = typeof body.nit === "string" ? body.nit.trim().toUpperCase() : "";
  exigir(
    documentoValido(nit, body.tipoDocumento || (/^[0-9]{13}$/.test(nit) ? "DPI" : "NIT")),
    "Documento inválido: DPI de 13 dígitos o NIT con guion opcional",
  );
  const correo = typeof body.correo === "string" ? body.correo.trim().toLowerCase() : null;
  exigir(!correo || correoValido(correo), "Correo inválido");
  exigir(
    !body.direccion || (typeof body.direccion === "string" && body.direccion.length <= 250),
    "Dirección demasiado larga",
  );
  return {
    nombre: body.nombre.trim(),
    nit: nit.replace("-", ""),
    correo: correo || null,
    telefono: normalizarTelefono(body.telefono),
    direccion: body.direccion || null,
  };
}
router.post(
  "/proveedores",
  permiso("PROVEEDORES_GESTIONAR"),
  endpoint(async (req, res, c) => {
    const datos = proveedor(req.body || {});
    await c.execute(
      "INSERT INTO proveedores(nombre,nit,correo,telefono,direccion) VALUES (:nombre,:nit,:correo,:telefono,:direccion)",
      datos,
    );
    await c.commit();
    res.status(201).json({ mensaje: "Proveedor registrado" });
  }),
);
router.put(
  "/proveedores/:id",
  permiso("PROVEEDORES_GESTIONAR"),
  endpoint(async (req, res, c) => {
    const id = Number(req.params.id);
    exigir(entero(id), "ID inválido");
    const datos = proveedor(req.body || {});
    exigir(["A", "I"].includes(req.body.estado), "Estado inválido");
    const r = await c.execute(
      "UPDATE proveedores SET nombre=:nombre,nit=:nit,correo=:correo,telefono=:telefono,direccion=:direccion,estado=:estado WHERE id_proveedor=:id",
      { ...datos, estado: req.body.estado, id },
    );
    exigir(r.rowsAffected, "Proveedor no encontrado", 404);
    await c.commit();
    res.json({ mensaje: "Proveedor actualizado" });
  }),
);
router.delete(
  "/proveedores/:id",
  permiso("PROVEEDORES_GESTIONAR"),
  endpoint(async (req, res, c) => {
    const id = Number(req.params.id);
    exigir(entero(id), "ID inválido");
    const registros = await filas(
      c,
      "SELECT id_proveedor FROM proveedores WHERE id_proveedor=:id FOR UPDATE",
      { id },
    );
    exigir(registros.length, "Proveedor no encontrado", 404);
    const compras = await filas(c, "SELECT COUNT(*) total FROM compras WHERE id_proveedor=:id", {
      id,
    });
    exigir(
      !compras[0].TOTAL,
      "Este proveedor tiene compras registradas. Desactívalo para conservar su historial.",
      409,
    );
    await c.execute("DELETE FROM proveedores WHERE id_proveedor=:id", { id });
    await c.commit();
    res.json({ mensaje: "Proveedor eliminado" });
  }),
);
router.patch(
  "/proveedores/:id/estado",
  permiso("PROVEEDORES_GESTIONAR"),
  endpoint(async (req, res, c) => {
    const id = Number(req.params.id),
      estado = req.body?.estado;
    exigir(entero(id) && ["A", "I"].includes(estado), "Datos inválidos");
    const r = await c.execute("UPDATE proveedores SET estado=:estado WHERE id_proveedor=:id", {
      id,
      estado,
    });
    exigir(r.rowsAffected, "Proveedor no encontrado", 404);
    await c.commit();
    res.json({
      mensaje: estado === "A" ? "Proveedor activado" : "Proveedor desactivado",
    });
  }),
);
router.get(
  "/compras",
  permiso("COMPRAS_GESTIONAR"),
  endpoint(async (req, res, c) => {
    res.json(
      await filas(
        c,
        `SELECT c.*,c.total-COALESCE((SELECT SUM(m.monto) FROM movimientos_financieros m WHERE m.id_compra=c.id_compra AND m.anulado_en IS NULL),0) pendiente_pago,p.nombre proveedor,r.id_recepcion,r.fecha fecha_recepcion,
        COALESCE((SELECT SUM(d.cantidad_danada*d.costo) FROM detalle_compras d WHERE d.id_compra=c.id_compra),0)
        - COALESCE((SELECT SUM(a.monto) FROM recuperaciones_compra a WHERE a.id_compra=c.id_compra),0) pendiente_recuperar
        FROM compras c JOIN proveedores p ON p.id_proveedor=c.id_proveedor JOIN recepciones r ON r.id_compra=c.id_compra ORDER BY c.id_compra DESC`,
      ),
    );
  }),
);
router.get(
  "/compras/:id",
  permiso("COMPRAS_GESTIONAR"),
  endpoint(async (req, res, c) => {
    const id = Number(req.params.id);
    exigir(entero(id), "ID inválido");
    const compras = await filas(c,
      "SELECT c.*,c.total-COALESCE((SELECT SUM(m.monto) FROM movimientos_financieros m WHERE m.id_compra=c.id_compra AND m.anulado_en IS NULL),0) pendiente_pago,p.nombre proveedor,p.nit proveedor_nit,u.nombre_completo registrado_por FROM compras c JOIN proveedores p ON p.id_proveedor=c.id_proveedor JOIN usuarios u ON u.id_usuario=c.id_usuario WHERE c.id_compra=:id", { id });
    exigir(compras.length, "Compra no encontrada", 404);
    const detalles = await filas(c,
      `SELECT d.*,p.nombre,p.codigo FROM detalle_compras d JOIN productos p ON p.id_producto=d.id_producto WHERE d.id_compra=:id ORDER BY d.id_detalle`, { id });
    const recuperaciones = await filas(c,
      "SELECT r.*,u.nombre_completo registrado_por FROM recuperaciones_compra r JOIN usuarios u ON u.id_usuario=r.id_usuario WHERE r.id_compra=:id ORDER BY r.id_recuperacion", { id });
    res.json({
      compra: compras[0],
      detalles,
      recuperaciones,
      saldoRechazos: resumenRecuperaciones(detalles, recuperaciones),
      recepcion: (await filas(c, "SELECT * FROM recepciones WHERE id_compra=:id", { id }))[0],
    });
  }),
);
router.post(
  "/compras/:id/recuperaciones",
  permiso("COMPRAS_GESTIONAR"),
  endpoint(async (req, res, c) => {
    const id = Number(req.params.id);
    exigir(entero(id), "ID inválido");
    const datos = validarRecuperacion(req.body || {});
    // Serializar resoluciones para impedir que dos abonos excedan el saldo.
    exigir((await filas(c, "SELECT id_compra FROM compras WHERE id_compra=:id FOR UPDATE", { id })).length,
      "Compra no encontrada", 404);
    const previos = await filas(c, "SELECT * FROM recuperaciones_compra WHERE clave=:clave", { clave: datos.clave });
    if (previos.length) {
      const p = previos[0];
      exigir(p.ID_COMPRA === id && p.TIPO === datos.tipo && centavos(p.MONTO) === centavos(datos.monto) &&
        p.REFERENCIA === datos.referencia && p.FECHA_DOCUMENTO === datos.fechaDocumento &&
        (p.OBSERVACIONES || null) === datos.observaciones, "La clave ya corresponde a otro registro", 409);
      res.json({ mensaje: "Resolución ya registrada", id: p.ID_RECUPERACION });
      return;
    }
    const detalles = await filas(c, "SELECT cantidad_danada,costo FROM detalle_compras WHERE id_compra=:id", { id });
    const registros = await filas(c, "SELECT tipo,monto FROM recuperaciones_compra WHERE id_compra=:id", { id });
    const saldo = resumenRecuperaciones(detalles, registros);
    exigir(centavos(datos.monto) <= centavos(saldo.pendiente), "El monto supera el saldo pendiente de los productos rechazados", 409);
    const r = await c.execute(
      `INSERT INTO recuperaciones_compra(id_compra,id_usuario,tipo,monto,referencia,fecha_documento,observaciones,clave)
       VALUES (:id,:usuario,:tipo,:monto,:referencia,:fechaDocumento,:observaciones,:clave) RETURNING id_recuperacion INTO :salida`,
      { id, usuario: req.usuario.ID_USUARIO, ...datos, salida: idSalida() });
    await c.commit();
    res.status(201).json({ mensaje: "Resolución registrada", id: r.outBinds.salida[0] });
  }),
);
router.get(
  "/catalogo-compras",
  permiso("COMPRAS_GESTIONAR"),
  endpoint(async (req, res, c) => {
    res.json(
      await filas(
        c,
        "SELECT id_producto,codigo,nombre FROM productos WHERE estado='A' ORDER BY nombre",
      ),
    );
  }),
);
router.post(
  "/compras",
  permiso("COMPRAS_GESTIONAR"),
  endpoint(async (req, res, c) => {
    const datos = validarCompra(req.body || {});
    const pago = req.body.pago ?? null;
    exigir(pago === null || (typeof pago === "object" && ["EFECTIVO", "TARJETA", "TRANSFERENCIA"].includes(pago.metodo) && typeof (pago.referencia ?? "") === "string" && (pago.referencia || "").length <= 100), "Pago de compra invalido");
    const solicitud = JSON.stringify({ ...datos, pago, usuario: req.usuario.ID_USUARIO });
    await c.execute("SELECT pg_advisory_xact_lock(hashtext(:clave))", { clave: `compra-${datos.clave}` });
    const [prev] = await filas(c, "SELECT id_compra,solicitud,total FROM compras WHERE clave=:clave", { clave: datos.clave });
    if (prev) {
      exigir(req.body.pago !== undefined && prev.SOLICITUD === solicitud, "La clave corresponde a otra compra", 409);
      return res.json({ id: prev.ID_COMPRA, total: prev.TOTAL, mensaje: "Compra ya registrada" });
    }
    // Clave única y factura única impiden entradas duplicadas ante reintentos.
    const prov = await filas(
      c,
      "SELECT id_proveedor FROM proveedores WHERE id_proveedor=:id AND estado='A' FOR UPDATE",
      { id: datos.idProveedor },
    );
    exigir(prov.length, "El proveedor no existe o está inactivo");
    const saldos = new Map();
    for (const d of datos.detalles) {
      const ps = await filas(
        c,
        "SELECT stock FROM productos WHERE id_producto=:id AND estado='A' FOR UPDATE",
        { id: d.idProducto },
      );
      exigir(ps.length, "Un producto no existe o está inactivo");
      exigir(ps[0].STOCK + d.cantidad - d.cantidadDanada <= 9999999999, "La existencia supera el límite permitido");
      saldos.set(d.idProducto, ps[0].STOCK);
    }
    const r = await c.execute(
      `INSERT INTO compras(id_proveedor,id_usuario,factura,clave,total,solicitud) VALUES (:proveedor,:usuario,:factura,:clave,:total,:solicitud) RETURNING id_compra INTO :id`,
      {
        proveedor: datos.idProveedor,
        usuario: req.usuario.ID_USUARIO,
        factura: datos.factura,
        clave: datos.clave,
        total: datos.total,
        solicitud,
        id: idSalida(),
      },
    );
    const id = r.outBinds.id[0];
    const recepcion = await c.execute(
      "INSERT INTO recepciones(id_compra,id_usuario) VALUES (:id,:usuario) RETURNING id_recepcion INTO :recepcion",
      { id, usuario: req.usuario.ID_USUARIO, recepcion: idSalida() },
    );
    for (const d of datos.detalles) {
      await c.execute(
        "INSERT INTO detalle_compras(id_compra,id_producto,cantidad,costo,cantidad_danada,observaciones) VALUES (:id,:idProducto,:cantidad,:costo,:cantidadDanada,:observaciones)",
        { id, ...d },
      );
      const aceptadas = d.cantidad - d.cantidadDanada;
      if (aceptadas === 0) continue;
      await c.execute("UPDATE productos SET stock=stock+:cantidad WHERE id_producto=:idProducto", {
        cantidad: aceptadas,
        idProducto: d.idProducto,
      });
      await c.execute(
        `INSERT INTO movimientos_inventario(id_producto,id_recepcion,id_usuario,tipo,cantidad,stock_anterior,stock_nuevo) VALUES (:producto,:recepcion,:usuario,'ENTRADA_COMPRA',:cantidad,:anterior,:nuevo)`,
        {
          producto: d.idProducto,
          recepcion: recepcion.outBinds.recepcion[0],
          usuario: req.usuario.ID_USUARIO,
          cantidad: aceptadas,
          anterior: saldos.get(d.idProducto),
          nuevo: saldos.get(d.idProducto) + aceptadas,
        },
      );
    }
    if (pago) {
      await c.execute("INSERT INTO movimientos_financieros(id_usuario,id_compra,clave,tipo,categoria,metodo,monto,fecha,concepto,referencia) VALUES (:usuario,:compra,:clave,'EGRESO','COMPRA',:metodo,:monto,CURRENT_DATE,:concepto,:referencia)",
        { usuario: req.usuario.ID_USUARIO, compra: id, clave: `compra-${id}`, metodo: pago.metodo, monto: datos.total, concepto: `Compra #${id} - ${datos.factura}`.slice(0,250), referencia: pago.referencia?.trim() || null });
    }
    await c.execute("INSERT INTO bitacora(id_usuario,accion,tabla_afectada,id_registro_afectado,detalle) VALUES (:usuario,'COMPRA_REGISTRADA','COMPRAS',:id,:detalle)", { usuario: req.usuario.ID_USUARIO, id, detalle: pago ? `Compra pagada: ${pago.metodo}, Q${datos.total}` : "Compra a credito" });
    await c.commit();
    res.status(201).json({
      id,
      mensaje: "Compra recibida e inventario actualizado",
      total: datos.total,
    });
  }),
);
router.get(
  "/inventario",
  permiso(["INVENTARIO_VER", "INVENTARIO_GESTIONAR"]),
  endpoint(async (req, res, c) => {
    res.json(
      await filas(
        c,
        `SELECT p.id_producto,p.codigo,p.nombre,p.stock,p.stock_minimo,p.estado,i.actualizado_en imagen_actualizada, CASE WHEN p.stock < p.stock_minimo AND p.estado='A' THEN 1 ELSE 0 END alerta FROM productos p LEFT JOIN imagenes_productos i ON i.id_producto=p.id_producto ORDER BY p.nombre`,
      ),
    );
  }),
);
router.get(
  "/movimientos",
  permiso("INVENTARIO_VER"),
  endpoint(async (req, res, c) => {
    res.json(
      await filas(
        c,
        `SELECT m.*,p.nombre,r.id_compra FROM movimientos_inventario m JOIN productos p ON p.id_producto=m.id_producto LEFT JOIN recepciones r ON r.id_recepcion=m.id_recepcion ORDER BY m.id_movimiento DESC`,
      ),
    );
  }),
);
router.patch(
  "/inventario/:id/minimo",
  permiso("INVENTARIO_GESTIONAR"),
  endpoint(async (req, res, c) => {
    const id = Number(req.params.id),
      minimo = req.body?.minimo;
    exigir(entero(id) && entero(minimo, 10), "El mínimo debe ser un entero mayor o igual a 10");
    const r = await c.execute("UPDATE productos SET stock_minimo=:minimo WHERE id_producto=:id", {
      minimo,
      id,
    });
    exigir(r.rowsAffected, "Producto no encontrado", 404);
    await c.commit();
    res.json({ mensaje: "Nivel mínimo actualizado" });
  }),
);
module.exports = router;
