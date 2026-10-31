import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quetzales, valorReporte, filtrarReporte, exportarFilasReporte, filtrosReporteIniciales as base } from '../src/services/reportesVista.js';
import { detalleAuditoria } from '../src/services/auditoriaVista.js';
test('moneda explícita, cero y cantidades sin Q',()=>{assert.equal(quetzales(33114),'Q 33,114.00');assert.equal(valorReporte(0,'moneda'),'Q 0.00');assert.equal(valorReporte(17,'numero'),'17');});
test('filtros combinados, búsqueda sin acentos, exportación y orden sin mutar',()=>{
 const filas=[{PROVEEDOR:'Lápices',TOTAL:100,PENDIENTE:10},{PROVEEDOR:'Otro',TOTAL:20,PENDIENTE:0}];
 const seleccion=filtrarReporte(filas,'compras',{...base,buscar:'lapices',estado:'pendiente',minimo:'50'});
 assert.equal(seleccion.length,1);assert.equal(exportarFilasReporte(seleccion,'compras')[0]['Total (Q)'],'100.00');
 assert.equal(filtrarReporte(filas,'compras',{...base,orden:'monto-asc'})[0].TOTAL,20);assert.equal(filas[0].TOTAL,100);
 assert.equal(filtrarReporte(filas,'compras',{...base,grupo:'Otro',estado:'pendiente'}).length,0);
});
test('inventario filtra alertas y productos filtra unidades',()=>{
 assert.equal(filtrarReporte([{ESTADO:'A',ALERTA:'REABASTECER'},{ESTADO:'I',ALERTA:'NORMAL'}],'inventario',{...base,estado:'reabastecer'}).length,1);
 assert.equal(filtrarReporte([{UNIDADES:2},{UNIDADES:5}],'productos',{...base,cantidad:'3'})[0].UNIDADES,5);
});
test('detalle del pedido traduce JSON y descuento sin revelar claves',()=>{
 const d=detalleAuditoria({DETALLE:'{"subtotal":3,"total":1.5,"estado":"PENDIENTE_APROBACION","clave":"secreto"} Descuento: 50%'});
 assert.deepEqual(d,[{nombre:'Subtotal',valor:'Q 3.00'},{nombre:'Total',valor:'Q 1.50'},{nombre:'Estado',valor:'Pendiente de aprobación'},{nombre:'Descuento',valor:'50 %'}]);
});
test('nombre eliminado conservado y evento antiguo honesto',()=>{
 const d=detalleAuditoria({ACCION:'USUARIO_ELIMINADO',DETALLE:'{"nombreCompleto":"Ana López","nombreUsuario":"ana"}'});
 assert.equal(d[0].valor,'Ana López');assert.equal(d[1].valor,'ana');
 const viejo=detalleAuditoria({ACCION:'USUARIO_ELIMINADO',DETALLE:'Usuario sin operaciones: 454'});
 assert.equal(viejo[0].valor,'454');assert.match(viejo[1].valor,/No quedó guardado/);
 assert.doesNotMatch(detalleAuditoria({DETALLE:'{"total":'} )[0].valor,/\{/);
});
