const { Pool } = require('pg');
const { RemoteSqlDataStore } = require('./remote-sql-store');

class PostgreSqlDataStore extends RemoteSqlDataStore {
  constructor(pool) { super(pool, 'postgresql'); }
  static async connect(connectionString, autoMigrate = true) {
    const store = new PostgreSqlDataStore(new Pool({ connectionString }));
    if (autoMigrate) await store.migrate();
    return store;
  }
  async query(sql, params = [], runner = this.client) { const result = await runner.query(sql, params); return { rows: result.rows || [], insertId: result.rows?.[0]?.id, affectedRows: result.rowCount }; }
  async transaction(callback) { const client = await this.client.connect(); try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async close() { await this.client.end(); }
}

module.exports = { PostgreSqlDataStore };
