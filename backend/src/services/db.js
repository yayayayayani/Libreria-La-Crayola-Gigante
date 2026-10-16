const oracle = require('../config/driver');
async function conectar() {
  const c = await oracle.getConnection({ user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectString: process.env.DB_CONNECT_STRING });
  c.callTimeout = 15000;
  return c;
}
const filas = async (c, sql, binds = {}) => (await c.execute(sql, binds, { outFormat: oracle.OUT_FORMAT_OBJECT })).rows;
const idSalida = () => ({ dir: oracle.BIND_OUT, type: oracle.NUMBER });
module.exports = { conectar, filas, idSalida };
