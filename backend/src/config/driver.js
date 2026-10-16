// Contrato común para el SQL parametrizado de esta aplicación. Oracle se conserva
// como opción de respaldo; PostgreSQL conserva los nombres JSON en mayúsculas.
const oracle = require('oracledb');
const { Pool, types } = require('pg');
const OUT_FORMAT_OBJECT = oracle.OUT_FORMAT_OBJECT;
let pool;
function motor() {
  const engine = process.env.DB_ENGINE || 'oracle';
  if (!['oracle', 'postgres'].includes(engine)) throw new Error('DB_ENGINE debe ser oracle o postgres');
  return engine;
}
function opcionesPostgres(connectionString) {
  if (!connectionString) throw new Error('Falta DATABASE_URL o NEON_DATABASE_URL');
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('URL PostgreSQL inválida');
  // Validar certificado y hostname; no usar rejectUnauthorized:false.
  const local = ['localhost','127.0.0.1','::1'].includes(url.hostname);
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','channel_binding']) url.searchParams.delete(key);
  return { connectionString:url.toString(), ssl:local ? false : {rejectUnauthorized:true},
    enableChannelBinding:true, connectionTimeoutMillis:30000, statement_timeout:20000,
    application_name:'libreria-crayola', options:'-c timezone=America/Guatemala' };
}
function obtenerPool() {
  if(!pool) {
    pool=new Pool({...opcionesPostgres(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL),max:10,idleTimeoutMillis:10000,allowExitOnIdle:true});
    pool.on('error',e=>console.error('Conexión PostgreSQL:',e.code || e.name));
  }
  return pool;
}
// Traductor limitado al SQL utilizado por el proyecto; no es un conversor DDL.
function preparar(sql, binds={}) {
  let salida;
  sql=sql.replace(/\bRETURNING\s+(\w+)\s+INTO\s+:(\w+)\s*$/i,(_,col,key)=>{salida={col:col.toLowerCase(),key};return `RETURNING ${col}`;});
  const valores=[], posiciones=new Map();
  const text=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|::\w+|:(\w+)|\bSYSTIMESTAMP\b/g, (token,key)=> {
    if(key) {
      if(!Object.hasOwn(binds,key)) throw new Error(`Parámetro ausente: ${key}`);
      if(!posiciones.has(key)){posiciones.set(key,valores.length+1);valores.push(binds[key] === '' ? null : binds[key]);}
      return `$${posiciones.get(key)}`;
    }
    return token==='SYSTIMESTAMP' ? 'LOCALTIMESTAMP' : token;
  });
  return {text,values:valores,salida};
}
function numeroSeguro(value,oid) {
  if(value===null || ![20,1700].includes(oid)) return value;
  const n=Number(value);
  if(!Number.isFinite(n) || (oid===20 && !Number.isSafeInteger(n))) throw new Error('Número fuera del rango seguro de JavaScript');
  return n;
}
async function getConnection(options) {
  if(motor()==='oracle') return oracle.getConnection(options);
  const client=await obtenerPool().connect();
  let transaccion=false,cerrada=false;
  const finalizar=async comando=>{if(transaccion){await client.query(comando);transaccion=false;}};
  return {
    async execute(sql,binds={},opts={}) {
      const q=preparar(sql,binds);
      try {
        if(!transaccion){await client.query('BEGIN');transaccion=true;}
        const r=await client.query({text:q.text,values:q.values,rowMode:'array',types:{getTypeParser(oid,format){
          // Oracle TIMESTAMP no tiene zona: interpretar la hora civil de Guatemala.
          if(oid===1114) return v=>new Date(v.replace(' ','T')+'-06:00');
          return types.getTypeParser(oid,format);
        }}});
        const rows=r.rows.map(row=>row.map((v,i)=>numeroSeguro(v,r.fields[i].dataTypeID)));
        const result={rows:opts.outFormat===OUT_FORMAT_OBJECT ? rows.map(row=>Object.fromEntries(r.fields.map((f,i)=>[f.name.toUpperCase(),row[i]]))) : rows,rowsAffected:r.rowCount,outBinds:{}};
        if(q.salida) result.outBinds[q.salida.key]=rows.map(row=>row[r.fields.findIndex(f=>f.name.toLowerCase()===q.salida.col)]);
        if(opts.autoCommit) await finalizar('COMMIT');
        return result;
      } catch(e) {
        // Mantener compatibilidad con los conflictos 409 de los controladores.
        if(e.code==='23505') e.errorNum=1;
        throw e;
      }
    },
    commit:()=>finalizar('COMMIT'), rollback:()=>finalizar('ROLLBACK'),
    async close(){if(cerrada)return;cerrada=true;try{await finalizar('ROLLBACK');}finally{client.release();}}
  };
}
async function cerrarPool(){if(pool){await pool.end();pool=undefined;}}
module.exports={getConnection,OUT_FORMAT_OBJECT,BIND_OUT:oracle.BIND_OUT,NUMBER:oracle.NUMBER,motor,preparar,opcionesPostgres,cerrarPool};
