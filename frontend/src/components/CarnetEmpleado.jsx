import { useEffect,useState } from 'react';
import api from '../services/api';
export default function CarnetEmpleado({token}) {
  const [datos,setDatos]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let vigente=true;api.get('/empleado/mi-carnet',{headers:{Authorization:`Bearer ${token}`}}).then(r=>{if(vigente)setDatos(r.data);}).catch(()=>{if(vigente)setError('No se pudo cargar tu carnet');});return()=>{vigente=false;};},[token]);
  if(error)return <p role="alert">{error}</p>;
  if(!datos)return <p>Cargando carnet…</p>;
  if(!datos.empleado || !datos.resumen || !Array.isArray(datos.ventas))return <p role="alert">No se pudo cargar tu carnet</p>;
  const {empleado:e,resumen:r,ventas}=datos;
  const q=n=>Number(n).toLocaleString('es-GT',{style:'currency',currency:'GTQ'});
  return <section className="carnet-empleado" aria-label="Mi carnet"><div className="carnet-identidad"><span className="avatar-empleado">{e.NOMBRE_COMPLETO?.split(' ').slice(0,2).map(n=>n[0]).join('')}</span><div><small>EMPLEADO #{e.ID_USUARIO}</small><h2>{e.NOMBRE_COMPLETO}</h2><p>{e.PUESTO || 'Empleado'} · {e.NOMBRE_USUARIO}</p><p>{e.CORREO}</p></div></div><dl><div><dt>Sueldo mensual</dt><dd>{e.SUELDO==null?'Sin asignar':q(e.SUELDO)}</dd></div><div><dt>Horario</dt><dd>{e.HORARIO||'Sin asignar'}</dd></div><div><dt>Ventas pagadas este mes</dt><dd>{r.VENTAS} · {q(r.TOTAL)}</dd></div></dl><details><summary>Mis últimas ventas</summary><div className="tabla-scroll"><table className="usuarios-tabla"><thead><tr><th>Venta</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead><tbody>{ventas.map(v=><tr key={v.ID_VENTA}><td>#{v.ID_VENTA}</td><td>{v.CLIENTE_NOMBRE}</td><td>{q(v.TOTAL)}</td><td>{v.ESTADO}</td></tr>)}{!ventas.length&&<tr><td colSpan="4">Sin ventas registradas</td></tr>}</tbody></table></div></details></section>;
}
