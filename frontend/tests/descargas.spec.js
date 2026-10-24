import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('productos descarga solo resultados filtrados y deshabilita listas vacías', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const ruta = new URL(route.request().url()).pathname.replace('/api', '');
    const ok = json => route.fulfill({ json });
    if (ruta === '/auth/login') return ok({ token: 'prueba', usuario: { nombre: 'Prueba' } });
    if (ruta === '/auth/permisos') return ok({ usuario: { idRol: 1, nombre: 'Prueba', rol: 'Administrador' }, permisos: ['PRODUCTOS_VER'] });
    if (ruta === '/productos') return ok([
      { ID_PRODUCTO: 1, CODIGO: 'L01', NOMBRE: 'Lápiz azul', CATEGORIA: 'Escritura', PRECIO: 12.5, STOCK: 8, ESTADO: 'A', INTERNO: 'No exportar' },
      { ID_PRODUCTO: 2, CODIGO: 'C02', NOMBRE: 'Cuaderno', CATEGORIA: 'Papel', PRECIO: 20, STOCK: 10, ESTADO: 'A' },
    ]);
    if (ruta.endsWith('/imagen')) return route.fulfill({ status: 204 });
    return ok([]);
  });
  await page.goto('/');
  await page.locator('#usuario').fill('prueba');
  await page.locator('#contrasena').fill('prueba');
  await page.getByRole('button', { name: /Iniciar sesi/ }).click();
  await page.getByRole('button', { name: /^Productos/ }).click();
  const buscar = page.getByPlaceholder(/Buscar/);
  await buscar.fill('Lápiz');
  const boton = page.getByRole('button', { name: 'Descargar CSV', exact: true });
  await expect(boton).toBeEnabled();
  const descarga = page.waitForEvent('download');
  await boton.click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/^productos-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile(await archivo.path(), 'utf8');
  expect(csv).toContain('Lápiz azul');
  expect(csv).toContain('Precio (Q)');
  expect(csv).toContain('12.50');
  expect(csv).not.toContain('Cuaderno');
  expect(csv).not.toContain('No exportar');
  await buscar.fill('inexistente');
  await expect(boton).toBeDisabled();
});
