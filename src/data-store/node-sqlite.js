const { DatabaseSync } = require('node:sqlite');
const { StudyDatabase } = require('../database');

class NodeSqliteCompat {
  constructor(filename) { this.raw = new DatabaseSync(filename); }
  prepare(sql) { return this.raw.prepare(sql); }
  exec(sql) { return this.raw.exec(sql); }
  pragma(statement) { return this.raw.exec(`PRAGMA ${statement}`); }
  close() { return this.raw.close(); }
  transaction(callback) {
    return (...args) => {
      this.raw.exec('BEGIN');
      try { const result = callback(...args); this.raw.exec('COMMIT'); return result; }
      catch (error) { this.raw.exec('ROLLBACK'); throw error; }
    };
  }
}

class NodeSqliteDataStore extends StudyDatabase {
  constructor(filename) { super(filename, { Database: NodeSqliteCompat }); }
}

module.exports = { NodeSqliteDataStore, NodeSqliteCompat };
