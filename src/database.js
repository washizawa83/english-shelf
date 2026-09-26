const { intervals, notionPageId } = require('./study-domain');

const tables = {
  words: {
    table: 'words',
    fields: ['vocabulary', 'inflection', 'meaning', 'example', 'last_reviewed_at', 'forgetting_level'],
    required: ['vocabulary']
  },
  sentences: {
    table: 'sentences',
    fields: ['title', 'meaning', 'similar_sentences', 'last_reviewed_at', 'forgetting_level'],
    required: ['title']
  }
};

class StudyDatabase {
  constructor(filename, options = {}) {
    const Database = options.Database || require('better-sqlite3');
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vocabulary TEXT NOT NULL,
        inflection TEXT NOT NULL DEFAULT '',
        meaning TEXT NOT NULL DEFAULT '',
        example TEXT NOT NULL DEFAULT '',
        last_reviewed_at TEXT,
        forgetting_level,
        notion_page_id TEXT UNIQUE,
        notion_url TEXT,
        source_body TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sentences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        meaning TEXT NOT NULL DEFAULT '',
        similar_sentences TEXT NOT NULL DEFAULT '',
        last_reviewed_at TEXT,
        forgetting_level,
        notion_page_id TEXT UNIQUE,
        notion_url TEXT,
        source_body TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS curriculum_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        learning_objective TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT '未着手' CHECK(status IN ('未着手', '学習中', '完了')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS curriculum_unit_grammar_items (
        unit_id INTEGER NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
        grammar_item_id INTEGER NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (unit_id, grammar_item_id)
      );
      CREATE TABLE IF NOT EXISTS study_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        mastery_note TEXT NOT NULL DEFAULT '',
        user_note TEXT NOT NULL DEFAULT '',
        curriculum_unit_id INTEGER REFERENCES curriculum_units(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_study_logs_recorded_at ON study_logs(recorded_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_study_logs_curriculum_unit_id ON study_logs(curriculum_unit_id);
    `);
    this.ensureMigrationColumns();
    this.ensureCurriculumDetailColumns();
    this.ensureStudyLogColumns();
  }

  ensureMigrationColumns() {
    for (const table of ['words', 'sentences']) {
      const columns = new Set(this.db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
      if (!columns.has('notion_page_id')) this.db.exec(`ALTER TABLE ${table} ADD COLUMN notion_page_id TEXT`);
      if (!columns.has('notion_url')) this.db.exec(`ALTER TABLE ${table} ADD COLUMN notion_url TEXT`);
      if (!columns.has('source_body')) this.db.exec(`ALTER TABLE ${table} ADD COLUMN source_body TEXT NOT NULL DEFAULT ''`);
      this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_notion_page_id ON ${table}(notion_page_id) WHERE notion_page_id IS NOT NULL`);
    }
  }

  ensureCurriculumDetailColumns() {
    const columns = new Set(this.db.prepare('PRAGMA table_info(curriculum_units)').all().map(row => row.name));
    const additions = {
      basics_text: "TEXT NOT NULL DEFAULT ''",
      rules_json: "TEXT NOT NULL DEFAULT '[]'",
      examples_json: "TEXT NOT NULL DEFAULT '[]'",
      practice_json: "TEXT NOT NULL DEFAULT '[]'",
      reference_links_json: "TEXT NOT NULL DEFAULT '[]'",
      mastery_percent: "INTEGER NOT NULL DEFAULT 0 CHECK(mastery_percent BETWEEN 0 AND 100)"
    };
    for (const [column, definition] of Object.entries(additions)) {
      if (!columns.has(column)) this.db.exec(`ALTER TABLE curriculum_units ADD COLUMN ${column} ${definition}`);
    }
  }

  ensureStudyLogColumns() {
    const columns = new Set(this.db.prepare('PRAGMA table_info(study_logs)').all().map(row => row.name));
    if (!columns.has('user_note')) this.db.exec("ALTER TABLE study_logs ADD COLUMN user_note TEXT NOT NULL DEFAULT ''");
  }

  definition(kind) {
    if (!tables[kind]) throw new Error('Unknown entry type');
    return tables[kind];
  }

  list(kind, query = '') {
    const { table, fields } = this.definition(kind);
    const searchable = [...fields, 'source_body'];
    const normalizedQuery = String(query).trim();
    if (!normalizedQuery) return this.db.prepare(`SELECT * FROM ${table} ORDER BY updated_at DESC, id DESC`).all();
    const term = `%${normalizedQuery}%`;
    const where = searchable.map(field => `CAST(${field} AS TEXT) LIKE ?`).join(' OR ');
    if (kind === 'words') {
      return this.db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY CASE WHEN vocabulary LIKE ? THEN 0 ELSE 1 END, updated_at DESC, id DESC`).all(...searchable.map(() => term), `${normalizedQuery}%`);
    }
    return this.db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY updated_at DESC, id DESC`).all(...searchable.map(() => term));
  }

  get(kind, id) {
    const { table } = this.definition(kind);
    return this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) || null;
  }

  save(kind, payload) {
    const { table, fields, required } = this.definition(kind);
    const values = fields.map(field => field === 'forgetting_level' && typeof payload[field] === 'number'
      ? payload[field]
      : String(payload[field] ?? '').trim());
    if (required.some(field => !String(payload[field] ?? '').trim())) throw new Error('タイトル項目を入力してください');
    if (payload.id) {
      this.db.prepare(`UPDATE ${table} SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, payload.id);
      return this.get(kind, payload.id);
    }
    const result = this.db.prepare(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`).run(...values);
    return this.get(kind, result.lastInsertRowid);
  }

  importNotion(kind, rows, bodies = {}) {
    const { table } = this.definition(kind);
    const isWord = kind === 'words';
    const columns = isWord
      ? ['vocabulary', 'inflection', 'meaning', 'example', 'last_reviewed_at', 'forgetting_level']
      : ['title', 'meaning', 'similar_sentences', 'last_reviewed_at', 'forgetting_level'];
    const update = columns.map(column => `${column} = excluded.${column}`).join(', ');
    const statement = this.db.prepare(`
      INSERT INTO ${table} (${columns.join(', ')}, notion_page_id, notion_url, source_body)
      VALUES (${[...columns, 'notion_page_id', 'notion_url', 'source_body'].map(() => '?').join(', ')})
      ON CONFLICT(notion_page_id) DO UPDATE SET ${update}, notion_url = excluded.notion_url,
        source_body = excluded.source_body, updated_at = CURRENT_TIMESTAMP
    `);
    const run = this.db.transaction(sourceRows => {
      for (const row of sourceRows) {
        const values = isWord
          ? [row['単語'], row['変形'], row['意味'], row['例文'], row['date:最終復習日:start'], row['忘却レベル']]
          : [row['英文・文法'], row['意味'], row['類似の英文'], row['date:最終復習日:start'], row['忘却レベル']];
        statement.run(...values.map(value => value ?? ''), notionPageId(row.url), row.url, bodies[row.url] || bodies[`${row.url}?pvs=204`] || '');
      }
    });
    run(rows);
    return rows.length;
  }

  due(kind, now = new Date()) {
    return this.list(kind).filter(entry => {
      if (!entry.last_reviewed_at) return true;
      const reviewedAt = new Date(entry.last_reviewed_at).getTime();
      if (!Number.isFinite(reviewedAt)) return true;
      const numericLevel = Number(entry.forgetting_level);
      const level = Number.isInteger(numericLevel) && numericLevel >= 1 && numericLevel <= 8 ? numericLevel : 1;
      return reviewedAt + intervals[level] <= now.getTime();
    });
  }

  review(kind, id, result, now = new Date()) {
    const entry = this.get(kind, id);
    if (!entry) throw new Error('Entry not found');
    const numericLevel = Number(entry.forgetting_level);
    let level = Number.isInteger(numericLevel) && numericLevel >= 1 && numericLevel <= 8 ? numericLevel : 1;
    if (result === 'easy') level = Math.min(8, level + 1);
    if (result === 'hard') level = Math.max(1, level - 1);
    const { table } = this.definition(kind);
    this.db.prepare(`UPDATE ${table} SET forgetting_level = ?, last_reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(level, now.toISOString(), id);
    return this.get(kind, id);
  }

  listCurriculumUnits() {
    const units = this.db.prepare('SELECT * FROM curriculum_units ORDER BY sort_order, id').all();
    const items = this.db.prepare('SELECT s.* FROM sentences s JOIN curriculum_unit_grammar_items r ON r.grammar_item_id = s.id WHERE r.unit_id = ? ORDER BY s.id');
    const logs = this.db.prepare('SELECT id, recorded_at, title, summary, mastery_note FROM study_logs WHERE curriculum_unit_id = ? ORDER BY recorded_at DESC, id DESC');
    return units.map(unit => {
      const { basics_text, rules_json, examples_json, practice_json, reference_links_json, ...summary } = unit;
      return {
        ...summary,
        details: {
          basics: basics_text,
          rules: this.parseJsonArray(rules_json),
          examples: this.parseJsonArray(examples_json),
          practice: this.parseJsonArray(practice_json),
          references: this.parseJsonArray(reference_links_json)
        },
        grammar_items: items.all(unit.id),
        study_logs: logs.all(unit.id)
      };
    });
  }

  parseJsonArray(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveCurriculumDetails(id, details) {
    if (!this.getCurriculumUnit(id)) throw new Error('単元が見つかりません');
    this.db.prepare(`
      UPDATE curriculum_units
      SET basics_text = ?, rules_json = ?, examples_json = ?, practice_json = ?, reference_links_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      String(details.basics || '').trim(),
      JSON.stringify(details.rules || []),
      JSON.stringify(details.examples || []),
      JSON.stringify(details.practice || []),
      JSON.stringify(details.references || []),
      Number(id)
    );
    return this.getCurriculumUnit(id);
  }

  updateCurriculumMastery(id, input) {
    const unit = this.getCurriculumUnit(id);
    if (!unit) throw new Error('単元が見つかりません');
    let mastery;
    if (input.correct_answers !== undefined) {
      const correct = Number(input.correct_answers);
      if (!Number.isInteger(correct) || correct < 0 || correct > 10) throw new Error('正答数は0〜10の整数で指定してください');
      mastery = correct * 10;
    } else {
      mastery = Number(input.mastery_percent);
      if (!Number.isInteger(mastery) || mastery < 0 || mastery > 100) throw new Error('理解度は0〜100の整数で指定してください');
    }
    this.db.prepare('UPDATE curriculum_units SET mastery_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(mastery, Number(id));
    return this.getCurriculumUnit(id);
  }

  listStudyLogs() {
    return this.db.prepare(`
      SELECT l.*, u.title curriculum_unit_title
      FROM study_logs l
      LEFT JOIN curriculum_units u ON u.id = l.curriculum_unit_id
      ORDER BY l.recorded_at DESC, l.id DESC
    `).all();
  }

  getStudyLog(id) {
    return this.db.prepare(`
      SELECT l.*, u.title curriculum_unit_title
      FROM study_logs l
      LEFT JOIN curriculum_units u ON u.id = l.curriculum_unit_id
      WHERE l.id = ?
    `).get(Number(id)) || null;
  }

  createStudyLog(input, now = new Date()) {
    const title = String(input.title || '').trim();
    const summary = String(input.summary || '').trim();
    if (!title) throw new Error('記録タイトルを入力してください');
    if (!summary) throw new Error('学習要約を入力してください');
    const unitId = input.curriculum_unit_id === undefined || input.curriculum_unit_id === null || input.curriculum_unit_id === ''
      ? null
      : Number(input.curriculum_unit_id);
    if (unitId !== null && !this.getCurriculumUnit(unitId)) throw new Error('関連単元が見つかりません');
    const result = this.db.prepare(`
      INSERT INTO study_logs (recorded_at, title, summary, mastery_note, curriculum_unit_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(now.toISOString(), title, summary, String(input.mastery_note || '').trim(), unitId);
    return this.getStudyLog(result.lastInsertRowid);
  }

  updateStudyLogNote(id, userNote) {
    if (!this.getStudyLog(id)) throw new Error('学習記録が見つかりません');
    this.db.prepare('UPDATE study_logs SET user_note = ? WHERE id = ?').run(String(userNote || '').trim(), Number(id));
    return this.getStudyLog(id);
  }

  getCurriculumUnit(id) {
    return this.listCurriculumUnits().find(unit => unit.id === Number(id)) || null;
  }

  saveCurriculumUnit(payload) {
    const title = String(payload.title || '').trim();
    if (!title) throw new Error('単元タイトルを入力してください');
    const allowed = new Set(['未着手', '学習中', '完了']);
    const status = allowed.has(payload.status) ? payload.status : '未着手';
    if (payload.id) {
      const existing = this.getCurriculumUnit(payload.id);
      if (!existing) throw new Error('単元が見つかりません');
      const sortOrder = Number.isInteger(Number(payload.sort_order)) ? Number(payload.sort_order) : existing.sort_order;
      const nextStatus = allowed.has(payload.status) ? payload.status : existing.status;
      this.db.prepare('UPDATE curriculum_units SET title = ?, learning_objective = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, String(payload.learning_objective ?? existing.learning_objective).trim(), sortOrder, nextStatus, Number(payload.id));
      return this.getCurriculumUnit(payload.id);
    }
    const nextOrder = this.db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 value FROM curriculum_units').get().value;
    const sortOrder = Number.isInteger(Number(payload.sort_order)) ? Number(payload.sort_order) : nextOrder;
    const result = this.db.prepare('INSERT INTO curriculum_units (title, learning_objective, sort_order, status) VALUES (?, ?, ?, ?)').run(title, String(payload.learning_objective || '').trim(), sortOrder, status);
    return this.getCurriculumUnit(result.lastInsertRowid);
  }

  moveCurriculumUnit(id, direction) {
    const units = this.db.prepare('SELECT id, sort_order FROM curriculum_units ORDER BY sort_order, id').all();
    const index = units.findIndex(unit => unit.id === Number(id));
    const targetIndex = direction === 'up' ? index - 1 : direction === 'down' ? index + 1 : -1;
    if (index < 0 || targetIndex < 0 || targetIndex >= units.length) return this.getCurriculumUnit(id);
    const swap = this.db.transaction(() => {
      this.db.prepare('UPDATE curriculum_units SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(units[targetIndex].sort_order, units[index].id);
      this.db.prepare('UPDATE curriculum_units SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(units[index].sort_order, units[targetIndex].id);
    });
    swap();
    return this.getCurriculumUnit(id);
  }

  reorderCurriculumUnits(ids) {
    const known = new Set(this.db.prepare('SELECT id FROM curriculum_units').all().map(row => row.id));
    if (ids.length !== known.size || new Set(ids.map(Number)).size !== known.size || ids.some(id => !known.has(Number(id)))) throw new Error('すべての単元IDを重複なく指定してください');
    const update = this.db.prepare('UPDATE curriculum_units SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    this.db.transaction(() => ids.forEach((id, index) => update.run(index + 1, Number(id))))();
    return this.listCurriculumUnits();
  }

  linkGrammarItem(unitId, grammarItemId) {
    if (!this.getCurriculumUnit(unitId)) throw new Error('単元が見つかりません');
    if (!this.get('sentences', grammarItemId)) throw new Error('英文・文法項目が見つかりません');
    this.db.prepare('INSERT OR IGNORE INTO curriculum_unit_grammar_items (unit_id, grammar_item_id) VALUES (?, ?)').run(Number(unitId), Number(grammarItemId));
    return this.getCurriculumUnit(unitId);
  }

  unlinkGrammarItem(unitId, grammarItemId) {
    this.db.prepare('DELETE FROM curriculum_unit_grammar_items WHERE unit_id = ? AND grammar_item_id = ?').run(Number(unitId), Number(grammarItemId));
    return this.getCurriculumUnit(unitId);
  }

  counts() {
    return Object.fromEntries(Object.entries(tables).map(([kind, { table }]) => [kind, this.db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count]));
  }

  close() { this.db.close(); }
}

module.exports = { StudyDatabase, intervals, notionPageId };
