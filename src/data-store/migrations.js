const commonTail = dialect => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS curriculum_unit_grammar_items (unit_id BIGINT NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE, grammar_item_id BIGINT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE, created_at ${dialect === 'mysql' ? 'TIMESTAMP' : 'TIMESTAMPTZ'} NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (unit_id, grammar_item_id))`,
    `CREATE TABLE IF NOT EXISTS study_logs (id ${dialect === 'mysql' ? 'BIGINT AUTO_INCREMENT' : 'BIGSERIAL'} PRIMARY KEY, recorded_at VARCHAR(64) NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, mastery_note TEXT NOT NULL, user_note TEXT NOT NULL, curriculum_unit_id BIGINT REFERENCES curriculum_units(id) ON DELETE SET NULL, created_at ${dialect === 'mysql' ? 'TIMESTAMP' : 'TIMESTAMPTZ'} NOT NULL DEFAULT CURRENT_TIMESTAMP${dialect === 'mysql' ? ', INDEX idx_study_logs_recorded_at (recorded_at, id), INDEX idx_study_logs_curriculum_unit_id (curriculum_unit_id)' : ''})`
  ];
  if (dialect === 'postgresql') statements.push('CREATE INDEX IF NOT EXISTS idx_study_logs_recorded_at ON study_logs(recorded_at, id)', 'CREATE INDEX IF NOT EXISTS idx_study_logs_curriculum_unit_id ON study_logs(curriculum_unit_id)');
  return statements;
};

function initialSchema(dialect) {
  const id = dialect === 'mysql' ? 'BIGINT AUTO_INCREMENT' : 'BIGSERIAL';
  const timestamp = dialect === 'mysql' ? 'TIMESTAMP' : 'TIMESTAMPTZ';
  return [
    `CREATE TABLE IF NOT EXISTS words (id ${id} PRIMARY KEY, vocabulary TEXT NOT NULL, inflection TEXT NOT NULL, meaning TEXT NOT NULL, example TEXT NOT NULL, last_reviewed_at VARCHAR(64), forgetting_level INTEGER, notion_page_id VARCHAR(64) UNIQUE, notion_url TEXT, source_body TEXT NOT NULL, created_at ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS sentences (id ${id} PRIMARY KEY, title TEXT NOT NULL, meaning TEXT NOT NULL, similar_sentences TEXT NOT NULL, last_reviewed_at VARCHAR(64), forgetting_level INTEGER, notion_page_id VARCHAR(64) UNIQUE, notion_url TEXT, source_body TEXT NOT NULL, created_at ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS curriculum_units (id ${id} PRIMARY KEY, title TEXT NOT NULL, learning_objective TEXT NOT NULL, sort_order INTEGER NOT NULL, status VARCHAR(16) NOT NULL DEFAULT '未着手', basics_text TEXT NOT NULL, rules_json TEXT NOT NULL, examples_json TEXT NOT NULL, practice_json TEXT NOT NULL, reference_links_json TEXT NOT NULL, mastery_percent INTEGER NOT NULL DEFAULT 0, created_at ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at ${timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ...commonTail(dialect)
  ];
}

module.exports = {
  migrationsFor(dialect) {
    return [{ version: 1, name: 'initial_schema', statements: initialSchema(dialect) }];
  }
};
