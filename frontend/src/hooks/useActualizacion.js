import { useEffect, useRef } from "react";
// Consulta compartida cada 5 s y al recuperar foco, sin reemplazar formularios.
export default function useActualizacion(cargar, inmediato = false) {
  const ref = useRef(cargar);
  useEffect(() => {
    ref.current = cargar;
  });
  useEffect(() => {
    let ocupado = false;
    const refrescar = async () => {
      if (ocupado || document.hidden) return;
      ocupado = true;
      try {
        await ref.current();
      } finally {
        ocupado = false;
      }
    };
    const timer = setInterval(refrescar, 5000);
    if (inmediato) refrescar();
    window.addEventListener("focus", refrescar);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refrescar);
    };
  }, [inmediato]);
}
