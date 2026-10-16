import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import api from '../services/api';

export default function FotoProducto({ id, token, nombre, version = 0 }) {
  const [foto, setFoto] = useState(null);
  useEffect(() => {
    let vigente = true, url;
    const controller = new AbortController();
    api.get(`/productos/${id}/imagen`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob', signal: controller.signal })
      .then(r => { if (vigente && r.status === 200 && r.data.size) { url = URL.createObjectURL(r.data); setFoto(url); } else if (vigente) setFoto(null); })
      .catch(() => { if (vigente) setFoto(null); });
    return () => { vigente = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [id, token, version]);
  return foto ? <img className="producto-foto" src={foto} alt={nombre} loading="lazy" /> : <span className="producto-foto foto-vacia" role="img" aria-label={`Sin foto de ${nombre}`}><Package size={24}/></span>;
}
