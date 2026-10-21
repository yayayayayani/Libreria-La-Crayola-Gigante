import { useState } from 'react';
import api from '../services/api';
export default function PagoCompra({ compra, token, onActualizar }) {
  const [metodo,setMetodo]=useState('EFECTIVO'),[monto,setMonto]=useState(String(compra.PENDIENTE_PAGO ?? compra.TOTAL));
  const [referencia,setReferencia]=useState(''),[error,setError]=useState(''),[ocupado,setOcupado]=useState(false);
  const [clave,setClave]=useState(()=>crypto.randomUUID());
  const pendiente=Number(compra.PENDIENTE_PAGO ?? compra.TOTAL);
  if(pendiente<=0)return <p className="alerta-exito">Compra pagada</p>;
  return <details className="pago-compra"><summary>Registrar pago · Pendiente Q{pendiente.toFixed(2)}</summary>
    {error && <p role="alert">{error}</p>}
    <form onReset={()=>{setMetodo('EFECTIVO');setMonto(String(pendiente));setReferencia('');setError('');}} className="usuario-form" onSubmit={async e=>{e.preventDefault();if(ocupado)return;setOcupado(true);setError('');try{
      const fecha=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guatemala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      await api.post('/finanzas/movimientos',{clave,categoria:'COMPRA',metodo,monto:Number(monto),fecha,concepto:`Pago compra #${compra.ID_COMPRA}`,idCompra:compra.ID_COMPRA,referencia},{headers:{Authorization:`Bearer ${token}`}});
      setClave(crypto.randomUUID());await onActualizar();
    }catch(e){setError(e.response?.data?.mensaje||'No se pudo registrar el pago');}finally{setOcupado(false);}}}>
      <label>Monto a pagar (Q)<input type="number" required min="0.01" max={pendiente} step="0.01" value={monto} onChange={e=>setMonto(e.target.value)} /></label>
      <label>Método de pago<select value={metodo} onChange={e=>setMetodo(e.target.value)}>{['EFECTIVO','TARJETA','TRANSFERENCIA'].map(m=><option key={m}>{m}</option>)}</select></label>
      <label>Referencia<input maxLength="100" value={referencia} onChange={e=>setReferencia(e.target.value)} /></label><button disabled={ocupado}>Registrar pago de compra</button>
    </form></details>;
}
