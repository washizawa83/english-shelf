const { intervals, notionPageId } = require('../study-domain');
const { migrationsFor } = require('./migrations');

const definitions = {
  words: { table: 'words', fields: ['vocabulary', 'inflection', 'meaning', 'example', 'last_reviewed_at', 'forgetting_level'], required: 'vocabulary' },
  sentences: { table: 'sentences', fields: ['title', 'meaning', 'similar_sentences', 'last_reviewed_at', 'forgetting_level'], required: 'title' }
};
const statuses = new Set(['未着手', '学習中', '完了']);

class RemoteSqlDataStore {
  constructor(client, dialect) { this.client = client; this.dialect = dialect; }
  definition(kind) { if (!definitions[kind]) throw new Error('Unknown entry type'); return definitions[kind]; }
  placeholders(count, start = 1) { return Array.from({ length: count }, (_, index) => this.dialect === 'postgresql' ? `$${start + index}` : '?').join(', '); }
  async rows(sql, params = [], runner) { return (await this.query(sql, params, runner)).rows; }
  async one(sql, params = [], runner) { return (await this.rows(sql, params, runner))[0] || null; }

  async migrate() {
    await this.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name VARCHAR(128) NOT NULL, applied_at ${this.dialect === 'mysql' ? 'TIMESTAMP' : 'TIMESTAMPTZ'} NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const applied = new Set((await this.rows('SELECT version FROM schema_migrations')).map(row => Number(row.version)));
    for (const migration of migrationsFor(this.dialect)) {
      if (applied.has(migration.version)) continue;
      await this.transaction(async runner => {
        for (const statement of migration.statements) await this.query(statement, [], runner);
        await this.query(`INSERT INTO schema_migrations (version, name) VALUES (${this.placeholders(2)})`, [migration.version, migration.name], runner);
      });
    }
  }

  async list(kind, query = '') {
    const { table, fields } = this.definition(kind), searchable = [...fields, 'source_body'];
    const normalized = String(query).trim();
    if (!normalized) return this.rows(`SELECT * FROM ${table} ORDER BY updated_at DESC, id DESC`);
    const term = `%${normalized}%`, params = searchable.map(() => term);
    let position = 1;
    const where = searchable.map(field => `CAST(${field} AS ${this.dialect === 'postgresql' ? 'TEXT' : 'CHAR'}) LIKE ${this.dialect === 'postgresql' ? `$${position++}` : '?'}`).join(' OR ');
    let order = 'updated_at DESC, id DESC';
    if (kind === 'words') { order = `CASE WHEN vocabulary LIKE ${this.dialect === 'postgresql' ? `$${position++}` : '?'} THEN 0 ELSE 1 END, ${order}`; params.push(`${normalized}%`); }
    return this.rows(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${order}`, params);
  }

  async get(kind, id) { return this.one(`SELECT * FROM ${this.definition(kind).table} WHERE id = ${this.placeholders(1)}`, [Number(id)]); }

  async save(kind, payload) {
    const { table, fields, required } = this.definition(kind);
    if (!String(payload[required] || '').trim()) throw new Error('タイトル項目を入力してください');
    const values = fields.map(field => field === 'forgetting_level' && typeof payload[field] === 'number'
      ? payload[field]
      : String(payload[field] ?? '').trim());
    if (payload.id) {
      let position = 1;
      const set = fields.map(field => `${field} = ${this.dialect === 'postgresql' ? `$${position++}` : '?'}`).join(', ');
      await this.query(`UPDATE ${table} SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ${this.dialect === 'postgresql' ? `$${position}` : '?'}`, [...values, Number(payload.id)]);
      return this.get(kind, payload.id);
    }
    const result = await this.query(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${this.placeholders(fields.length)})${this.dialect === 'postgresql' ? ' RETURNING id' : ''}`, values);
    return this.get(kind, this.dialect === 'postgresql' ? result.rows[0].id : result.insertId);
  }

  async importNotion(kind, sourceRows, bodies = {}) {
    const { table } = this.definition(kind), isWord = kind === 'words';
    const columns = isWord ? ['vocabulary', 'inflection', 'meaning', 'example', 'last_reviewed_at', 'forgetting_level'] : ['title', 'meaning', 'similar_sentences', 'last_reviewed_at', 'forgetting_level'];
    await this.transaction(async runner => {
      for (const row of sourceRows) {
        const values = isWord ? [row['単語'], row['変形'], row['意味'], row['例文'], row['date:最終復習日:start'], row['忘却レベル']] : [row['英文・文法'], row['意味'], row['類似の英文'], row['date:最終復習日:start'], row['忘却レベル']];
        const url = row.url, allColumns = [...columns, 'notion_page_id', 'notion_url', 'source_body'];
        const params = [...values.map(value => value ?? ''), notionPageId(url), url, bodies[url] || bodies[`${url}?pvs=204`] || ''];
        const updates = [...columns, 'notion_url', 'source_body'].map(column => this.dialect === 'postgresql' ? `${column} = EXCLUDED.${column}` : `${column} = VALUES(${column})`).join(', ');
        const conflict = this.dialect === 'postgresql' ? `ON CONFLICT (notion_page_id) DO UPDATE SET ${updates}, updated_at = CURRENT_TIMESTAMP` : `ON DUPLICATE KEY UPDATE ${updates}, updated_at = CURRENT_TIMESTAMP`;
        await this.query(`INSERT INTO ${table} (${allColumns.join(', ')}) VALUES (${this.placeholders(allColumns.length)}) ${conflict}`, params, runner);
      }
    });
    return sourceRows.length;
  }

  async due(kind, now = new Date()) {
    return (await this.list(kind)).filter(entry => {
      if (!entry.last_reviewed_at) return true;
      const reviewed = new Date(entry.last_reviewed_at).getTime(), raw = Number(entry.forgetting_level);
      const level = Number.isInteger(raw) && raw >= 1 && raw <= 8 ? raw : 1;
      return !Number.isFinite(reviewed) || reviewed + intervals[level] <= now.getTime();
    });
  }

  async review(kind, id, result, now = new Date()) {
    const entry = await this.get(kind, id); if (!entry) throw new Error('Entry not found');
    const raw = Number(entry.forgetting_level); let level = Number.isInteger(raw) && raw >= 1 && raw <= 8 ? raw : 1;
    if (result === 'easy') level = Math.min(8, level + 1); if (result === 'hard') level = Math.max(1, level - 1);
    await this.query(`UPDATE ${this.definition(kind).table} SET forgetting_level = ${this.placeholders(1)}, last_reviewed_at = ${this.dialect === 'postgresql' ? '$2' : '?'}, updated_at = CURRENT_TIMESTAMP WHERE id = ${this.dialect === 'postgresql' ? '$3' : '?'}`, [level, now.toISOString(), Number(id)]);
    return this.get(kind, id);
  }

  parseJson(value) { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  async listCurriculumUnits() {
    const units = await this.rows('SELECT * FROM curriculum_units ORDER BY sort_order, id');
    return Promise.all(units.map(async unit => {
      const grammar = await this.rows(`SELECT s.* FROM sentences s JOIN curriculum_unit_grammar_items r ON r.grammar_item_id = s.id WHERE r.unit_id = ${this.placeholders(1)} ORDER BY s.id`, [unit.id]);
      const logs = await this.rows(`SELECT id, recorded_at, title, summary, mastery_note FROM study_logs WHERE curriculum_unit_id = ${this.placeholders(1)} ORDER BY recorded_at DESC, id DESC`, [unit.id]);
      const { basics_text, rules_json, examples_json, practice_json, reference_links_json, ...summary } = unit;
      return { ...summary, details: { basics: basics_text, rules: this.parseJson(rules_json), examples: this.parseJson(examples_json), practice: this.parseJson(practice_json), references: this.parseJson(reference_links_json) }, grammar_items: grammar, study_logs: logs };
    }));
  }
  async getCurriculumUnit(id) { return (await this.listCurriculumUnits()).find(unit => Number(unit.id) === Number(id)) || null; }

  async saveCurriculumDetails(id, details) {
    if (!await this.getCurriculumUnit(id)) throw new Error('単元が見つかりません');
    await this.query(`UPDATE curriculum_units SET basics_text = ${this.placeholders(1)}, rules_json = ${this.dialect === 'postgresql' ? '$2' : '?'}, examples_json = ${this.dialect === 'postgresql' ? '$3' : '?'}, practice_json = ${this.dialect === 'postgresql' ? '$4' : '?'}, reference_links_json = ${this.dialect === 'postgresql' ? '$5' : '?'}, updated_at = CURRENT_TIMESTAMP WHERE id = ${this.dialect === 'postgresql' ? '$6' : '?'}`, [String(details.basics || '').trim(), JSON.stringify(details.rules || []), JSON.stringify(details.examples || []), JSON.stringify(details.practice || []), JSON.stringify(details.references || []), Number(id)]);
    return this.getCurriculumUnit(id);
  }
  async updateCurriculumMastery(id, input) {
    if (!await this.getCurriculumUnit(id)) throw new Error('単元が見つかりません');
    let mastery;
    if (input.correct_answers !== undefined) {
      const correct = Number(input.correct_answers);
      if (!Number.isInteger(correct) || correct < 0 || correct > 10) throw new Error('正答数は0〜10の整数で指定してください');
      mastery = correct * 10;
    } else mastery = Number(input.mastery_percent);
    if (!Number.isInteger(mastery) || mastery < 0 || mastery > 100) throw new Error('理解度は0〜100の整数で指定してください');
    await this.query(`UPDATE curriculum_units SET mastery_percent = ${this.placeholders(1)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${this.dialect === 'postgresql' ? '$2' : '?'}`, [mastery, Number(id)]);
    return this.getCurriculumUnit(id);
  }

  async listStudyLogs() { return this.rows('SELECT l.*, u.title curriculum_unit_title FROM study_logs l LEFT JOIN curriculum_units u ON u.id = l.curriculum_unit_id ORDER BY l.recorded_at DESC, l.id DESC'); }
  async getStudyLog(id) { return this.one(`SELECT l.*, u.title curriculum_unit_title FROM study_logs l LEFT JOIN curriculum_units u ON u.id = l.curriculum_unit_id WHERE l.id = ${this.placeholders(1)}`, [Number(id)]); }
  async createStudyLog(input, now = new Date()) {
    const title = String(input.title || '').trim(), summary = String(input.summary || '').trim(); if (!title || !summary) throw new Error('記録タイトルと学習要約を入力してください');
    const unitId = input.curriculum_unit_id === undefined || input.curriculum_unit_id === null || input.curriculum_unit_id === '' ? null : Number(input.curriculum_unit_id);
    if (unitId !== null && !await this.getCurriculumUnit(unitId)) throw new Error('関連単元が見つかりません');
    const sql = `INSERT INTO study_logs (recorded_at, title, summary, mastery_note, user_note, curriculum_unit_id) VALUES (${this.placeholders(6)})${this.dialect === 'postgresql' ? ' RETURNING id' : ''}`;
    const result = await this.query(sql, [now.toISOString(), title, summary, String(input.mastery_note || '').trim(), '', unitId]);
    return this.getStudyLog(this.dialect === 'postgresql' ? result.rows[0].id : result.insertId);
  }
  async updateStudyLogNote(id, note) { if (!await this.getStudyLog(id)) throw new Error('学習記録が見つかりません'); await this.query(`UPDATE study_logs SET user_note = ${this.placeholders(1)} WHERE id = ${this.dialect === 'postgresql' ? '$2' : '?'}`, [String(note || '').trim(), Number(id)]); return this.getStudyLog(id); }

  async saveCurriculumUnit(payload) {
    const title = String(payload.title || '').trim(); if (!title) throw new Error('単元タイトルを入力してください');
    const status = statuses.has(payload.status) ? payload.status : '未着手';
    if (payload.id) {
      const existing = await this.getCurriculumUnit(payload.id); if (!existing) throw new Error('単元が見つかりません');
      await this.query(`UPDATE curriculum_units SET title = ${this.placeholders(1)}, learning_objective = ${this.dialect === 'postgresql' ? '$2' : '?'}, sort_order = ${this.dialect === 'postgresql' ? '$3' : '?'}, status = ${this.dialect === 'postgresql' ? '$4' : '?'}, updated_at = CURRENT_TIMESTAMP WHERE id = ${this.dialect === 'postgresql' ? '$5' : '?'}`, [title, String(payload.learning_objective ?? existing.learning_objective).trim(), Number(payload.sort_order ?? existing.sort_order), statuses.has(payload.status) ? payload.status : existing.status, Number(payload.id)]);
      return this.getCurriculumUnit(payload.id);
    }
    const next = await this.one('SELECT COALESCE(MAX(sort_order), 0) + 1 value FROM curriculum_units');
    const params = [title, String(payload.learning_objective || '').trim(), Number(payload.sort_order ?? next.value), status, '', '[]', '[]', '[]', '[]'];
    const result = await this.query(`INSERT INTO curriculum_units (title, learning_objective, sort_order, status, basics_text, rules_json, examples_json, practice_json, reference_links_json) VALUES (${this.placeholders(9)})${this.dialect === 'postgresql' ? ' RETURNING id' : ''}`, params);
    return this.getCurriculumUnit(this.dialect === 'postgresql' ? result.rows[0].id : result.insertId);
  }

  async moveCurriculumUnit(id, direction) {
    const units = await this.rows('SELECT id, sort_order FROM curriculum_units ORDER BY sort_order, id'), index = units.findIndex(unit => Number(unit.id) === Number(id));
    const target = direction === 'up' ? index - 1 : direction === 'down' ? index + 1 : -1; if (index < 0 || target < 0 || target >= units.length) return this.getCurriculumUnit(id);
    await this.transaction(async runner => { await this.query(`UPDATE curriculum_units SET sort_order = ${this.placeholders(1)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${this.dialect === 'postgresql' ? '$2' : '?'}`, [units[target].sort_order, units[index].id], runner); await this.query(`UPDATE curriculum_units SET sort_order = ${this.placeholders(1)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${this.dialect === 'postgresql' ? '$2' : '?'}`, [units[index].sort_order, units[target].id], runner); });
    return this.getCurriculumUnit(id);
  }
  async reorderCurriculumUnits(ids) { const units = await this.rows('SELECT id FROM curriculum_units'); const known = new Set(units.map(row => Number(row.id))); if (ids.length !== known.size || new Set(ids.map(Number)).size !== known.size || ids.some(id => !known.has(Number(id)))) throw new Error('すべての単元IDを重複なく指定してください'); await this.transaction(async runner => { for (let index = 0; index < ids.length; index += 1) await this.query(`UPDATE curriculum_units SET sort_order = ${this.placeholders(1)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${this.dialect === 'postgresql' ? '$2' : '?'}`, [index + 1, Number(ids[index])], runner); }); return this.listCurriculumUnits(); }
  async linkGrammarItem(unitId, grammarItemId) { if (!await this.getCurriculumUnit(unitId) || !await this.get('sentences', grammarItemId)) throw new Error('関連対象が見つかりません'); const sql = this.dialect === 'postgresql' ? 'INSERT INTO curriculum_unit_grammar_items (unit_id, grammar_item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING' : 'INSERT IGNORE INTO curriculum_unit_grammar_items (unit_id, grammar_item_id) VALUES (?, ?)'; await this.query(sql, [Number(unitId), Number(grammarItemId)]); return this.getCurriculumUnit(unitId); }
  async unlinkGrammarItem(unitId, grammarItemId) { await this.query(`DELETE FROM curriculum_unit_grammar_items WHERE unit_id = ${this.placeholders(1)} AND grammar_item_id = ${this.dialect === 'postgresql' ? '$2' : '?'}`, [Number(unitId), Number(grammarItemId)]); return this.getCurriculumUnit(unitId); }
  async counts() { const result = {}; for (const [kind, definition] of Object.entries(definitions)) result[kind] = Number((await this.one(`SELECT COUNT(*) count FROM ${definition.table}`)).count); return result; }
}

module.exports = { RemoteSqlDataStore };
