const schema = process.env.CRAYOLA_TEST_SCHEMA;
if (!/^sprint4_test_[a-f0-9]{16}$/.test(schema || "")) throw new Error("Falta el esquema aislado de pruebas");
const pg = require("pg"), OriginalPool = pg.Pool;
pg.Pool = class extends OriginalPool {
  async connect() {
    const client = await super.connect();
    if (!client.crayolaSchema) {
      const query = client.query.bind(client);
      client.query = async (...args) => {
        const result = await query(...args);
        if (args[0] === "BEGIN") await query(`SET LOCAL search_path TO "${schema}"`);
        return result;
      };
      client.crayolaSchema = true;
    }
    return client;
  }
};
