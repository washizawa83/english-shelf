const mysql = require('mysql2/promise');
const { RemoteSqlDataStore } = require('./remote-sql-store');

class MySqlDataStore extends RemoteSqlDataStore {
  constructor(pool) { super(pool, 'mysql'); }
  static async connect(connectionString, autoMigrate = true) {
    const store = new MySqlDataStore(mysql.createPool(connectionString));
    if (autoMigrate) await store.migrate();
    return store;
  }
  async query(sql, params = [], runner = this.client) { const [rows] = await runner.query(sql, params); return { rows: Array.isArray(rows) ? rows : [], insertId: rows.insertId, affectedRows: rows.affectedRows }; }
  async transaction(callback) { const connection = await this.client.getConnection(); try { await connection.beginTransaction(); const result = await callback(connection); await connection.commit(); return result; } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); } }
  async close() { await this.client.end(); }
}

module.exports = { MySqlDataStore };
