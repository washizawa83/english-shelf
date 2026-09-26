const { StudyDatabase } = require('../database');
const { assertDataStore } = require('./contract');
const { loadDataStoreConfig } = require('./config');

async function createDataStore(options = {}) {
  const config = loadDataStoreConfig(options);
  let store;
  if (config.driver === 'sqlite') {
    store = process.versions.electron
      ? new StudyDatabase(config.filename)
      : new (require('./node-sqlite').NodeSqliteDataStore)(config.filename);
  }
  if (config.driver === 'mysql') store = await require('./mysql').MySqlDataStore.connect(config.connectionString, config.autoMigrate);
  if (config.driver === 'postgresql') store = await require('./postgresql').PostgreSqlDataStore.connect(config.connectionString, config.autoMigrate);
  assertDataStore(store);
  return store;
}

async function createSelectedDataStore(options = {}) {
  if (options.filename || process.env.ENGLISH_SHELF_DB || process.env.ENGLISH_SHELF_DB_DRIVER || process.env.ENGLISH_SHELF_DATABASE_URL) return createDataStore(options);
  const path = require('node:path');
  const { createSupabaseSettingsStore } = require('../supabase-settings');
  const { createSupabaseRuntimeStore } = require('../supabase-runtime');
  const userDataPath = path.dirname(options.defaultSqlitePath || options.filename);
  const runtime = createSupabaseRuntimeStore(userDataPath).load();
  if (runtime.activeStore === 'supabase') {
    const settings = createSupabaseSettingsStore(userDataPath).load();
    if (!settings.url || !settings.publishableKey || !runtime.accessToken) throw new Error('Supabaseの有効な接続状態がありません。SQLiteへ戻してください。');
    return assertDataStore(new (require('./supabase').SupabaseDataStore)(settings, runtime.accessToken));
  }
  return createDataStore(options);
}

module.exports = { createDataStore, createSelectedDataStore, loadDataStoreConfig };
