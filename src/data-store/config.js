const path = require('node:path');

const aliases = { postgres: 'postgresql', pg: 'postgresql', mariadb: 'mysql' };

function loadDataStoreConfig(options = {}) {
  const rawDriver = String(options.driver || process.env.ENGLISH_SHELF_DB_DRIVER || 'sqlite').toLowerCase();
  const driver = aliases[rawDriver] || rawDriver;
  if (!['sqlite', 'mysql', 'postgresql'].includes(driver)) throw new Error(`Unsupported database driver: ${rawDriver}`);
  const defaultSqlitePath = options.defaultSqlitePath || path.resolve(process.cwd(), 'data', 'english-study.db');
  const connectionString = options.connectionString || process.env.ENGLISH_SHELF_DATABASE_URL || '';
  if (driver !== 'sqlite' && !connectionString) throw new Error(`ENGLISH_SHELF_DATABASE_URL is required for ${driver}`);
  return {
    driver,
    filename: options.filename || process.env.ENGLISH_SHELF_DB || defaultSqlitePath,
    connectionString,
    autoMigrate: options.autoMigrate ?? process.env.ENGLISH_SHELF_DB_AUTO_MIGRATE !== 'false'
  };
}

module.exports = { loadDataStoreConfig };
