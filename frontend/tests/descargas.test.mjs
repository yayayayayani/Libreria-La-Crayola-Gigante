import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contenidoCsv } from '../src/services/descargas.js';

test('CSV conserva acentos, comas, comillas y saltos sin exponer campos ajenos al reporte', () => {
  const csv = contenidoCsv([{ NOMBRE: 'Lápiz, "azul"\nnuevo', PRECIO: 12.5, SECRETO: 'oculto' }], ['NOMBRE', 'PRECIO']);
  assert.equal(csv, '\uFEFF"Nombre","Precio (Q)"\r\n"Lápiz, ""azul""\nnuevo","12.50"');
});

test('neutraliza fórmulas ingresadas por usuarios', () => {
  for (const valor of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '\t=1', '\r=1']) {
    assert.ok(contenidoCsv([{ NOMBRE: valor }]).includes('"\'' + valor + '"'));
  }
});

test('fechas contables conservan su día y las horas se muestran en Guatemala', () => {
  assert.ok(contenidoCsv([{ DIA: '2026-10-24T00:00:00.000Z' }]).includes('"2026-10-24"'));
  assert.ok(contenidoCsv([{ FECHA: '2026-10-24' }]).includes('"2026-10-24"'));
  assert.ok(contenidoCsv([{ FECHA: '2026-10-24T02:30:00.000Z' }]).includes('"2026-10-23 20:30:00"'));
});

test('columnas estables, vacíos y estados legibles', () => {
  assert.equal(contenidoCsv([], ['NOMBRE', 'TOTAL']), '\uFEFF"Nombre","Total (Q)"');
  assert.equal(contenidoCsv([{ ESTADO: 'A', TOTAL: null, ALERTA: 1 }]), '\uFEFF"Estado","Total (Q)","Alerta"\r\n"Activo","","Reponer"');
});
