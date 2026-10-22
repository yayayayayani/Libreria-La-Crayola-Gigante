// Limpieza manual de etiquetas visibles; conserva claves internas y bitácora.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { conectar, filas } = require('../src/services/db');
const driver = require('../src/config/driver');

const campos = {
  productos: ['codigo', 'descripcion'],
  categorias: ['descripcion'],
  clientes: ['direccion'],
  proveedores: ['nombre'],
  usuarios: ['nombre_completo', 'nombre_usuario', 'puesto'],
  compras: ['factura'],
  pagos: ['referencia'],
  movimientos_financieros: ['concepto', 'referencia'],
  aprobaciones: ['motivo'],
  comprobantes: ['contenido'],
};
function limpiar(texto) {
  return texto
    .replace(/ \(demo(?:straci[oó]n)?\)/gi, '')
    .replace(/ para demostraci[oó]n/gi, '')
    .replace(/ de demostraci[oó]n/gi, '')
    .replace(/Demostraci[oó]n: /gi, '')
    .replace(/\bDEMO[-.]/gi, '');
}
function limpiarComprobante(texto) {
  const data = JSON.parse(texto);
  for (const detalle of data.detalles || []) {
    if (typeof detalle.CODIGO === 'string') detalle.CODIGO = limpiar(detalle.CODIGO);
  }
  for (const pago of data.pagos || []) {
    if (typeof pago.REFERENCIA === 'string') pago.REFERENCIA = limpiar(pago.REFERENCIA);
  }
  return JSON.stringify(data);
}
async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const c = await conectar();
  try {
    // Impide cambios concurrentes entre el respaldo y la actualización.
    if (aplicar) await c.execute(`LOCK TABLE ${Object.keys(campos).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    const cambios = [];
    for (const [tabla, columnas] of Object.entries(campos)) {
      for (const columna of columnas) {
        const registros = await filas(c, `SELECT "${columna}" valor, COUNT(*) cantidad FROM "${tabla}" WHERE "${columna}" ILIKE '%demo%' GROUP BY "${columna}"`);
        for (const r of registros) {
          const despues = tabla === 'comprobantes' ? limpiarComprobante(r.VALOR) : limpiar(r.VALOR);
          if (despues !== r.VALOR) cambios.push({ tabla, columna, antes: r.VALOR, despues, cantidad: Number(r.CANTIDAD) });
        }
      }
    }
    if (aplicar && cambios.length) {
      const dir = path.resolve(__dirname, '../../.migration-backups');
      fs.mkdirSync(dir, { recursive: true });
      const archivo = path.join(dir, `etiquetas-demo-${Date.now()}.json`);
      fs.writeFileSync(archivo, JSON.stringify({ fecha: new Date().toISOString(), cambios }, null, 2));
      for (const cambio of cambios) {
        const r = await c.execute(`UPDATE "${cambio.tabla}" SET "${cambio.columna}"=:despues WHERE "${cambio.columna}"=:antes`, { antes: cambio.antes, despues: cambio.despues });
        if (r.rowsAffected !== cambio.cantidad) throw new Error('La cantidad de registros cambió; se revierte la operación');
      }
      for (const [tabla, columnas] of Object.entries(campos)) {
        for (const columna of columnas) {
          const pendientes = await filas(c, `SELECT COUNT(*) cantidad FROM "${tabla}" WHERE "${columna}" ILIKE '%demo%'`);
          if (Number(pendientes[0].CANTIDAD)) throw new Error(`Quedan etiquetas en ${tabla}.${columna}`);
        }
      }
      await c.commit();
      console.log(`Respaldo: ${archivo}`);
    }
    const resumen = {};
    for (const x of cambios) resumen[`${x.tabla}.${x.columna}`] = (resumen[`${x.tabla}.${x.columna}`] || 0) + x.cantidad;
    console.log(JSON.stringify({ aplicado: aplicar, camposActualizados: resumen }, null, 2));
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
    await driver.cerrarPool();
  }
}
main().catch(e => { console.error(e.code || e.message); process.exitCode = 1; });
