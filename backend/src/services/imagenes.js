const sharp = require('sharp');
const { exigir } = require('./validaciones');
const MAX_BYTES = 3 * 1024 * 1024;

async function prepararImagen(valor) {
  if (valor === undefined || valor === null) return valor;
  exigir(typeof valor === 'string' && valor.length <= Math.ceil(MAX_BYTES / 3) * 4 + 100, 'La imagen debe pesar como máximo 3 MB');
  const partes = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(valor);
  exigir(partes, 'Selecciona una imagen PNG, JPEG o WebP');
  const bytes = Buffer.from(partes[2], 'base64');
  exigir(bytes.length <= MAX_BYTES, 'La imagen debe pesar como máximo 3 MB');
  try {
    const opciones = { limitInputPixels: 16000000, failOn: 'warning' };
    const meta = await sharp(bytes, opciones).metadata();
    exigir(['png', 'jpeg', 'webp'].includes(meta.format) && (meta.pages || 1) === 1, 'Usa una fotografía sin animación');
    const imagen = await sharp(bytes, opciones).rotate().resize(1000, 1000, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    return imagen.toString('base64');
  } catch {
    exigir(false, 'La imagen está dañada, es animada o supera 16 megapíxeles');
  }
}

async function guardarImagen(c, id, imagen) {
  if (imagen === undefined) return;
  await c.execute('DELETE FROM imagenes_productos WHERE id_producto=:id', { id });
  if (imagen !== null) await c.execute('INSERT INTO imagenes_productos(id_producto,contenido) VALUES (:id,:contenido)', { id, contenido: imagen });
}
module.exports = { prepararImagen, guardarImagen, MAX_BYTES };
