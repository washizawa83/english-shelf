const Database = require('better-sqlite3');
const db = new Database('data/english-study.db', { readonly: true });
for (const table of ['words', 'sentences']) {
  const summary = db.prepare(`SELECT COUNT(*) count, COUNT(notion_page_id) page_ids, SUM(source_body <> '') bodies FROM ${table}`).get();
  const invalidLevels = db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE forgetting_level IS NOT NULL AND forgetting_level <> '' AND (CAST(forgetting_level AS REAL) < 1 OR CAST(forgetting_level AS REAL) > 8 OR CAST(forgetting_level AS REAL) <> CAST(forgetting_level AS INTEGER))`).get().count;
  const invalidDates = db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE last_reviewed_at IS NOT NULL AND last_reviewed_at <> '' AND julianday(last_reviewed_at) IS NULL`).get().count;
  console.log(table, { ...summary, invalidLevels, invalidDates });
}
db.close();
