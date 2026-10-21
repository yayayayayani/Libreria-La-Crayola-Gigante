export const formularios = new Map();
export let envioActual = null;
export const firma = form => JSON.stringify(Array.from(form.elements).filter(e => !['submit','button'].includes(e.type)).map(e => [e.type, e.value, e.checked, e.files?.[0]?.name]));
export function iniciarEnvio(form) {
  let resolver;
  const promesa = new Promise(r => { resolver = r; });
  const grupo = { form, pendientes: 0, fallo: false, resolver, promesa };
  envioActual = grupo;
  setTimeout(() => { if (envioActual === grupo && !grupo.iniciado) { envioActual = null; resolver(false); } }, 100);
  return grupo;
}
export function adjuntarEnvio(config) {
  if (envioActual && ['post','put','patch','delete'].includes(config.method)) {
    config.grupoCambios = envioActual;
    envioActual.pendientes++; envioActual.iniciado = true;
  }
  return config;
}
export function terminarEnvio(config, exito) {
  const g = config?.grupoCambios;
  if (!g) return;
  g.pendientes--; g.fallo ||= !exito;
  setTimeout(() => {
    if (g.pendientes || g.terminado) return;
    g.terminado = true;
    if (!g.fallo) formularios.delete(g.form);
    if (envioActual === g) envioActual = null;
    g.resolver(!g.fallo);
  }, 25);
}
