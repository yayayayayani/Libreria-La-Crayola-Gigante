import { useState } from "react";
export function usePreferencia(clave, inicial, opciones) {
  const [valor, setValor] = useState(() => {
    try { const v = localStorage.getItem(`crayola.dashboard.${clave}`); return opciones.includes(v) ? v : inicial; }
    catch { return inicial; }
  });
  return [valor, v => { setValor(v); try { localStorage.setItem(`crayola.dashboard.${clave}`, v); } catch { /* Preferencia opcional. */ } }];
}
