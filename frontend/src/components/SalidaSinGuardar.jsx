import { useEffect, useRef, useState } from 'react';
import { formularios, firma, iniciarEnvio, envioActual } from '../services/cambios';
const pendientes = () => [...formularios].filter(([f,r]) => f.isConnected && firma(f)!==r.base).map(([f])=>f);
export default function SalidaSinGuardar() {
  const [accion, setAccion] = useState(null), [guardando,setGuardando] = useState(false);
  const permitir = useRef(false);
  const modal = useRef(null);
  useEffect(()=>{
    if(!accion)return;
    const anterior=document.activeElement;
    modal.current?.querySelector('button:last-child')?.focus();
    const teclado=e=>{
      if(e.key==='Escape'&&!guardando){e.preventDefault();setAccion(null);}
      if(e.key!=='Tab')return;
      const botones=[...modal.current.querySelectorAll('button:not(:disabled)')];
      if(!botones.length){e.preventDefault();return;}
      const primero=botones[0],ultimo=botones.at(-1);
      if(e.shiftKey&&document.activeElement===primero){e.preventDefault();ultimo.focus();}
      else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primero.focus();}
    };
    document.addEventListener('keydown',teclado,true);
    return()=>{document.removeEventListener('keydown',teclado,true);if(anterior?.isConnected)anterior.focus();};
  },[accion,guardando]);
  useEffect(() => {
    const formulario = e => {
      const f = e.target.closest?.('form');
      if (!f || f.matches('[data-sin-aviso]') || f.closest('.pedidos-filters') || f.querySelector('#contrasena')) return null;
      return f;
    };
    const preparar = e => {
      const f = formulario(e); if (!f) return;
      const anterior = formularios.get(f);
      if (!anterior) formularios.set(f,{base:firma(f),dirty:false});
    };
    const cambiar = e => {
      const f = formulario(e); if(!f) return;
      const r = formularios.get(f) || {base:'',dirty:false};
      r.dirty=true; formularios.set(f,r);
    };
    const enviar = e => { if(formulario(e)) iniciarEnvio(e.target); };
    const salir = e => {
      const boton=e.target.closest?.('button,a'); if(!boton || boton.closest('.aviso-salida'))return;
      const texto=boton.textContent.trim();
      const navega=boton.matches('.module-button,[data-salir]') || boton.closest('nav.sprint-tabs') || /^(?:←\s*)?(Volver|Cerrar|Cancelar|Limpiar|Editar|Nuevo|Nueva)\b/i.test(texto);
      if(!navega)return;
      if(permitir.current){permitir.current=false;return;}
      if(!pendientes().length){formularios.clear();return;}
      e.preventDefault();e.stopPropagation();setAccion({boton});
    };
    const antes=e=>{if(pendientes().length){e.preventDefault();e.returnValue='';}};
    const cambio=e=>{if(pendientes().length)setAccion({continuar:e.detail});else e.detail();};
    document.addEventListener('focusin',preparar,true);document.addEventListener('pointerdown',preparar,true);
    document.addEventListener('input',cambiar,true);document.addEventListener('change',cambiar,true);
    document.addEventListener('submit',enviar,true);document.addEventListener('click',salir,true);
    window.addEventListener('beforeunload',antes);
    window.addEventListener('solicitar-salida',cambio);
    return ()=>{document.removeEventListener('focusin',preparar,true);document.removeEventListener('pointerdown',preparar,true);document.removeEventListener('input',cambiar,true);document.removeEventListener('change',cambiar,true);document.removeEventListener('submit',enviar,true);document.removeEventListener('click',salir,true);window.removeEventListener('beforeunload',antes);window.removeEventListener('solicitar-salida',cambio);formularios.clear();};
  },[]);
  const continuar=(descartar=false)=>{if(descartar)for(const f of pendientes())f.reset();formularios.clear();setAccion(null);if(accion.continuar){accion.continuar();return;}permitir.current=true;accion.boton.click();};
  const guardar=async()=>{
    setGuardando(true);
    try {
      for(const f of pendientes()){
        if(!f.reportValidity()){setAccion(null);return;}
        // El submit normal conserva las validaciones y los permisos de cada módulo.
        if(envioActual?.pendientes){if(!await envioActual.promesa)return;continue;}
        f.requestSubmit();
        const grupo=envioActual;
        if(!grupo || !await grupo.promesa){setAccion(null);return;}
      }
      continuar();
    } finally {setGuardando(false);}
  };
  return accion && <div ref={modal} className="aviso-salida" role="alertdialog" aria-modal="true" aria-labelledby="titulo-salida"><div><h2 id="titulo-salida">Cambios sin guardar</h2><p>¿Qué quieres hacer con los datos ingresados?</p><button disabled={guardando} onClick={guardar}>{guardando?'Guardando…':'Guardar y salir'}</button><button disabled={guardando} onClick={()=>continuar(true)}>Salir sin guardar</button><button disabled={guardando} onClick={()=>setAccion(null)}>Seguir editando</button></div></div>;
}
