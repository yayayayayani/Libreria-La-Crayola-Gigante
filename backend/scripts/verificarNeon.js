// Verificación inicial posterior a la copia; cambios legítimos posteriores producen diferencias.
require('dotenv').config({quiet:true});
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Client}=require('pg');
const {opcionesPostgres}=require('../src/config/driver');
const {canonico,seleccion,tablas}=require('./migrarNeon');
async function main(){
 const informe=JSON.parse(fs.readFileSync(path.join(__dirname,'../../docs/sprint2/MIGRACION_NEON_RESULTADO.json'),'utf8'));
 const backup=JSON.parse(fs.readFileSync(path.join(__dirname,'../../.migration-backups',path.basename(informe.respaldo)),'utf8'));
 const c=new Client(opcionesPostgres(process.env.NEON_DATABASE_URL));
 try{
  await c.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  for(const tabla of tablas){
   const {columnas,rows}=backup.tablas[tabla];
   const r=await c.query(`SELECT ${seleccion(columnas,true)} FROM ${tabla.toLowerCase()}${tabla==='MIGRACIONES'?" WHERE nombre <> '003_oracle_a_postgres'":''}`);
   const esperado=canonico(rows,columnas),actual=canonico(r.rows,columnas);
   // No imprimir datos personales o hashes de contraseña si hay diferencias.
   assert.ok(JSON.stringify(actual)===JSON.stringify(esperado),`Diferencias en ${tabla}`);
  }
  await c.query('COMMIT');console.log('VERIFICADO: las 15 tablas coinciden con el respaldo original; sin registros de prueba residuales.');
 }finally{await c.end();}
}
main().catch(e=>{console.error('Verificación:',e.code||e.message);process.exitCode=1;});
