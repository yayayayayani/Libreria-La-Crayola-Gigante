const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validarCompra} = require('../src/services/validaciones');
test('Cuerpos y detalles malformados producen errores de validación 400', () => {
  for (const datos of [null,undefined,[],false,'compra']) {
    assert.throws(() => validarCompra(datos), {status:400});
  }
  for (const detalle of [null,[],false,3,'producto']) {
    assert.throws(() => validarCompra({idProveedor:1,factura:'F1',clave:'1234567890123456',detalles:[detalle]}), {status:400});
  }
});
