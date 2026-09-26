const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DATA_STORE_METHODS, assertDataStore } = require('../src/data-store/contract');
const { loadDataStoreConfig, createDataStore } = require('../src/data-store/factory');
const { migrationsFor } = require('../src/data-store/migrations');
const { MySqlDataStore } = require('../src/data-store/mysql');
const { PostgreSqlDataStore } = require('../src/data-store/postgresql');

test('data store configuration defaults to SQLite and validates remote URLs', () => {
  const config = loadDataStoreConfig({ filename: 'local.db' });
  assert.equal(config.driver, 'sqlite');
  assert.equal(config.filename, 'local.db');
  assert.equal(loadDataStoreConfig({ driver: 'pg', connectionString: 'postgresql://example/db' }).driver, 'postgresql');
  assert.equal(loadDataStoreConfig({ driver: 'mariadb', connectionString: 'mysql://example/db' }).driver, 'mysql');
  assert.throws(() => loadDataStoreConfig({ driver: 'postgresql' }), /DATABASE_URL/);
  assert.throws(() => loadDataStoreConfig({ driver: 'oracle', connectionString: 'x' }), /Unsupported/);
});

test('SQLite factory remains the default and satisfies the shared contract', async () => {
  const filename = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-store-')), 'study.db');
  const store = await createDataStore({ filename });
  assert.equal(assertDataStore(store), store);
  assert.deepEqual(DATA_STORE_METHODS.filter(method => typeof store[method] !== 'function'), []);
  assert.deepEqual(store.counts(), { words: 0, sentences: 0 });
  store.close();
});

test('remote adapters expose real driver-backed contract implementations', () => {
  assert.equal(typeof MySqlDataStore.connect, 'function');
  assert.equal(typeof PostgreSqlDataStore.connect, 'function');
  for (const Adapter of [MySqlDataStore, PostgreSqlDataStore]) {
    const methods = new Set(Object.getOwnPropertyNames(Adapter.prototype));
    assert.ok(methods.has('query'));
    assert.ok(methods.has('transaction'));
    assert.ok(methods.has('close'));
  }
});

test('factory can construct MySQL and PostgreSQL adapters without opening a connection', async () => {
  const mysql = await createDataStore({ driver: 'mysql', connectionString: 'mysql://user:pass@127.0.0.1:3306/english_shelf', autoMigrate: false });
  const postgres = await createDataStore({ driver: 'postgresql', connectionString: 'postgresql://user:pass@127.0.0.1:5432/english_shelf', autoMigrate: false });
  assert.equal(mysql.constructor.name, 'MySqlDataStore');
  assert.equal(postgres.constructor.name, 'PostgreSqlDataStore');
  assertDataStore(mysql);
  assertDataStore(postgres);
  await mysql.close();
  await postgres.close();
});

test('dialect migrations use native identity syntax and version tracking', () => {
  const mysql = migrationsFor('mysql')[0].statements.join('\n');
  const postgres = migrationsFor('postgresql')[0].statements.join('\n');
  assert.match(mysql, /AUTO_INCREMENT/);
  assert.match(postgres, /BIGSERIAL/);
  assert.equal(migrationsFor('mysql')[0].version, 1);
});

test('desktop and MCP entry points use the shared factory and service', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const mcp = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'english-shelf', 'server', 'index.js'), 'utf8');
  assert.match(main, /createDataStore/);
  assert.match(main, /new StudyService/);
  assert.match(mcp, /createSelectedDataStore/);
  assert.match(mcp, /new StudyService/);
  assert.doesNotMatch(mcp, /node:sqlite|better-sqlite3/);
});
