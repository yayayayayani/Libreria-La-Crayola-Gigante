import { quetzales, fechaReporte } from "./reportesVista.js";
export const modulosAuditoria = {
  USUARIOS: ["Usuarios", "Altas de cuentas, cambios de datos, activaciones, desactivaciones y eliminaciones. El evento distingue a quien hizo el cambio de la cuenta afectada."],
  ROLES: ["Roles y permisos", "Cambios en los permisos asignados a cada rol. Aquí puedes revisar qué acceso se modificó y quién lo autorizó."],
  CLIENTES: ["Clientes", "Clientes registrados, cambios en sus datos y activaciones o desactivaciones. Esta sección muestra el historial de cambios, no la lista completa de clientes."],
  PRODUCTOS: ["Productos e inventario", "Altas y ediciones de productos, cambios de estado y ajustes del stock mínimo. Las salidas por ventas se registran junto con los pedidos."],
  CATEGORIAS: ["Categorías", "Creación de categorías para organizar los productos. Aquí aparecen las acciones registradas, no todas las categorías existentes."],
  PROVEEDORES: ["Proveedores", "Proveedores registrados, editados, activados, desactivados o eliminados. Los registros con compras conservan su historial."],
  COMPRAS: ["Compras y recuperaciones", "Compras recibidas y resoluciones de mercadería rechazada, como notas de crédito, reembolsos o pérdidas."],
  PEDIDOS: ["Pedidos y ventas", "Creación, aprobación, rechazo o cancelación de pedidos; ventas, pagos, puntos, comprobantes y salidas de inventario relacionadas."],
  FINANZAS: ["Finanzas", "Movimientos financieros registrados o anulados, con su concepto, monto y motivo cuando estén disponibles."],
};
export const accionesAuditoria = {
  USUARIO_CREADO: "Usuario registrado", USUARIO_ACTUALIZADO: "Datos del usuario actualizados", USUARIO_ESTADO: "Estado del usuario cambiado", USUARIO_ELIMINADO: "Usuario eliminado",
  PERMISOS_ACTUALIZADOS: "Permisos del rol actualizados", CLIENTE_CREADO: "Cliente registrado", CLIENTE_ACTUALIZADO: "Cliente actualizado", CLIENTE_ESTADO: "Estado del cliente cambiado",
  PRODUCTO_CREADO: "Producto registrado", PRODUCTO_ACTUALIZADO: "Producto actualizado", PRODUCTO_ESTADO: "Estado del producto cambiado", MINIMO_ACTUALIZADO: "Stock mínimo actualizado", CATEGORIA_CREADA: "Categoría registrada",
  PROVEEDOR_CREADO: "Proveedor registrado", PROVEEDOR_ACTUALIZADO: "Proveedor actualizado", PROVEEDOR_ELIMINADO: "Proveedor eliminado", PROVEEDOR_ESTADO: "Estado del proveedor cambiado",
  COMPRA_REGISTRADA: "Compra registrada", RECUPERACION_REGISTRADA: "Recuperación de compra registrada", PEDIDO_CREADO: "Pedido creado", APROBADO: "Pedido aprobado", RECHAZADO: "Pedido rechazado", PEDIDO_CANCELADO: "Pedido cancelado", VENTA_CREADA: "Venta creada", PAGO_REGISTRADO: "Pago registrado", PUNTOS_CANJEADOS: "Puntos canjeados", PUNTOS_ACUMULADOS: "Puntos acumulados", COMPROBANTE_EMITIDO: "Comprobante emitido", SALIDA_INVENTARIO: "Salida de inventario", MOVIMIENTO_REGISTRADO: "Movimiento financiero registrado", MOVIMIENTO_ANULADO: "Movimiento financiero anulado",
};
const estados = { PENDIENTE_APROBACION: "Pendiente de aprobación", APROBADO: "Aprobado", RECHAZADO: "Rechazado", CANCELADO: "Cancelado", VENDIDO: "Pendiente de pago", PAGADO: "Pagado", A: "Activo", I: "Inactivo", EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", NOTA_CREDITO: "Nota de crédito", REEMBOLSO: "Reembolso", PERDIDA: "Pérdida", SALDO_INICIAL: "Saldo inicial", OTRO_INGRESO: "Otro ingreso", GASTO: "Gasto", COMPRA: "Compra", RETIRO: "Retiro", INGRESO: "Ingreso", EGRESO: "Egreso", APERTURA: "Apertura" };
export const nombreAccion = codigo => accionesAuditoria[codigo] || String(codigo || "Actividad registrada").toLowerCase().replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
export const nombreModulo = codigo => modulosAuditoria[codigo]?.[0] || codigo || "General";
function separarObjeto(texto) {
  if (!texto.startsWith("{")) return null;
  let nivel = 0, comillas = false, escape = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && comillas) { escape = true; continue; }
    if (c === '"') { comillas = !comillas; continue; }
    if (comillas) continue;
    if (c === "{") nivel++;
    if (c === "}" && --nivel === 0) {
      try { return { datos: JSON.parse(texto.slice(0,i+1)), resto: texto.slice(i+1).trim() }; } catch { return null; }
    }
  }
  return null;
}
export function detalleAuditoria(evento) {
  const texto = String(evento.DETALLE || "").trim(), objeto = separarObjeto(texto);
  if (objeto) {
    const campos = { nombreCompleto: "Nombre de la persona", nombreUsuario: "Cuenta afectada", motivo: "Motivo", subtotal: "Subtotal", total: "Total", monto: "Monto", estado: "Estado", descuento: "Descuento", tipo: "Tipo de movimiento", categoria: "Categoría", metodo: "Método", fecha: "Fecha", concepto: "Concepto", referencia: "Referencia", compra: "Compra n.º", puntos: "Puntos" };
    const detalles = Object.entries(campos).filter(([k]) => objeto.datos[k] !== undefined && objeto.datos[k] !== null && objeto.datos[k] !== "").map(([k,nombre]) => {
      const v = objeto.datos[k];
      const valor = ["subtotal","total","monto"].includes(k) && Number.isFinite(Number(v)) ? quetzales(v) : k === "descuento" ? `${v} %` : k === "fecha" ? fechaReporte(v) : estados[v] || String(v);
      return { nombre, valor };
    });
    const descuento = objeto.resto.match(/^Descuento:\s*([\d.]+)%$/);
    if (descuento) detalles.push({ nombre: "Descuento", valor: `${descuento[1]} %` });
    else if (objeto.resto) detalles.push({ nombre: "Observación", valor: objeto.resto });
    return detalles.length ? detalles : [{ nombre: "Detalle", valor: "Este registro no contiene un detalle descriptivo disponible." }];
  }
  if (evento.ACCION === "USUARIO_ELIMINADO" && texto.startsWith("Usuario sin operaciones:")) return [
    { nombre: "Cuenta eliminada", valor: texto.slice("Usuario sin operaciones:".length).trim() },
    { nombre: "Nombre completo", valor: "No quedó guardado en este evento antiguo." },
  ];
  if (texto.startsWith("{")) return [{ nombre: "Detalle", valor: "El detalle antiguo no tiene un formato legible completo. Usa el número de registro para identificar la operación." }];
  const estado = texto.match(/^Estado:\s*([AI])$/);
  if (estado) return [{ nombre: "Nuevo estado", valor: estados[estado[1]] }];
  return [{ nombre: "Detalle", valor: (texto || "No se guardaron detalles adicionales.").replace(/\bQ\s*(\d+(?:\.\d+)?)/g, (_,n) => quetzales(n)).replace(/\b(EFECTIVO|TARJETA|TRANSFERENCIA|NOTA_CREDITO|REEMBOLSO|PERDIDA)\b/g, v => estados[v]) }];
}
