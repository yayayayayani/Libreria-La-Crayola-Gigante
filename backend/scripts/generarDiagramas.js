// Figuras técnicas reproducibles; no utiliza imágenes generativas.
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname,'../../docs/entrega2/figuras');
fs.mkdirSync(dir,{recursive:true});
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const box = (x,y,w,h,title,lines=[]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#f4f7f2" stroke="#294b3e" stroke-width="2"/><text x="${x+w/2}" y="${y+32}" text-anchor="middle" font-size="20" font-weight="bold">${escape(title)}</text>${lines.map((l,i)=>`<text x="${x+w/2}" y="${y+62+i*26}" text-anchor="middle" font-size="17">${escape(l)}</text>`).join('')}`;
const arrow = (x,y,x2,y2,label='') => `<path d="M${x},${y} L${x2},${y2}" fill="none" stroke="#486452" stroke-width="2.5" marker-end="url(#a)"/>${label?`<text x="${(x+x2)/2+8}" y="${(y+y2)/2-10}" font-size="16" fill="#354f40">${escape(label)}</text>`:''}`;
async function save(name,w,h,body){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#486452"/></marker></defs><rect width="100%" height="100%" fill="white"/><g font-family="Arial,sans-serif" fill="#203d31">${body}</g></svg>`;
 fs.writeFileSync(path.join(dir,name+'.svg'),svg);
 await sharp(Buffer.from(svg)).resize(w*2,h*2).png().toFile(path.join(dir,name+'.png'));
}
async function main(){
 await save('arquitectura',1000,610,
  box(30,35,280,100,'David',['Navegador + backend local'])+box(360,35,280,100,'Yordy',['Navegador + backend local'])+box(690,35,280,100,'Daylin',['Navegador + backend local'])+
  arrow(170,135,430,260,'TLS')+arrow(500,135,500,260,'TLS')+arrow(830,135,570,260,'TLS')+
  box(300,260,400,145,'PostgreSQL en Neon',['Compras y recepciones','Existencias y movimientos','Fotografías compartidas'])+
  box(220,470,560,90,'Una base y una rama para los tres',['El hosting de la aplicación es independiente'])+arrow(500,405,500,470));
 await save('flujo',1000,750,
  box(30,30,260,100,'1. Proveedor activo',['Factura nueva'])+box(370,30,260,100,'2. Detalle',['Producto, cantidad y costo'])+box(710,30,260,100,'3. Recepción completa',['Confirmación del usuario'])+
  arrow(290,80,370,80)+arrow(630,80,710,80)+arrow(840,130,840,225)+
  box(650,225,320,110,'4. Validar y bloquear',['Permisos y restricciones','Productos ordenados por ID'])+
  arrow(650,280,570,280)+box(140,225,430,110,'5. Una transacción',['Compra + detalle + recepción','Stock + movimientos'])+
  arrow(355,335,355,435)+box(140,435,430,100,'6. Confirmar (COMMIT)',['Todo se guarda en conjunto'])+
  arrow(570,280,800,435,'Si falla')+box(650,435,320,100,'Revertir (ROLLBACK)',['Ningún cambio parcial'])+
  arrow(355,535,355,625)+box(140,625,430,90,'7. Consultar resultado',['Inventario, historial y alertas']));
 await save('modelo',1100,850,
  box(30,35,280,115,'PROVEEDORES',['PK id_proveedor','NIT único'])+
  box(410,35,280,115,'COMPRAS',['PK id_compra','FK proveedor / usuario'])+
  box(790,35,280,115,'RECEPCIONES',['PK id_recepcion','FK compra única'])+
  arrow(310,90,410,90,'1 : N')+arrow(690,90,790,90,'1 : 1')+
  box(410,280,280,130,'DETALLE_COMPRAS',['PK id_detalle','FK compra / producto','Cantidad y costo'])+arrow(550,150,550,280,'1 : N')+
  box(30,280,280,130,'PRODUCTOS',['PK id_producto','FK categoría','Stock y mínimo'])+arrow(310,345,410,345,'1 : N')+
  box(790,280,280,150,'MOVIMIENTOS',['PK id_movimiento','FK producto / recepción','Antes + cantidad = nuevo','Recepción opcional en apertura'])+arrow(930,150,930,280,'1 : N')+
  arrow(170,410,170,525)+box(30,525,280,115,'IMAGENES_PRODUCTOS',['PK/FK id_producto','Cero o una fotografía'])+
  box(410,525,280,115,'CATEGORIAS',['PK id_categoria','Una categoría por producto'])+arrow(410,580,310,390,'1 : N')+
  `<path d="M170,410 L170,465 L930,465 L930,430" fill="none" stroke="#486452" stroke-width="2.5" marker-end="url(#a)"/><text x="450" y="455" font-size="16">Un producto tiene muchos movimientos</text>`+
  `<text x="40" y="725" font-size="18">El usuario registra compras, recepciones y movimientos.</text><text x="40" y="760" font-size="18">La recepción completa es obligatoria en el flujo de la aplicación.</text><text x="40" y="795" font-size="18">El esquema también contiene usuarios, roles, permisos, clientes y cola de correo.</text>`);
 console.log('Tres diagramas generados en SVG editable y PNG.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
