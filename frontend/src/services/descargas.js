export function contenidoCsv(filas) {
  const campos = [...new Set(filas.flatMap(Object.keys))];
  const celda = valor => {
    let texto = valor == null ? '' : String(valor);
    // Evita interpretar datos ingresados por usuarios como fórmulas de Excel.
    if (typeof valor === 'string' && /^[\s]*[=+@-]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replaceAll('"','""') + '"';
  };
  return '\uFEFF' + [campos.map(celda).join(','), ...filas.map(f=>campos.map(c=>celda(f[c])).join(','))].join('\r\n');
}
export function descargarCsv(filas, nombre) {
  const url = URL.createObjectURL(new Blob([contenidoCsv(filas)], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a');a.href=url;a.download=nombre;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
