const { intervals, notionPageId } = require('../study-domain');

const definitions = {
  words: { table: 'english_shelf_words', required: 'vocabulary', fields: ['vocabulary', 'inflection', 'meaning', 'example', 'last_reviewed_at', 'forgetting_level'] },
  sentences: { table: 'english_shelf_sentences', required: 'title', fields: ['title', 'meaning', 'similar_sentences', 'last_reviewed_at', 'forgetting_level'] }
};
const statuses = new Set(['未着手', '学習中', '完了']);

class SupabaseDataStore {
  constructor(settings, accessToken, { fetchImpl = globalThis.fetch } = {}) { this.settings = settings; this.accessToken = accessToken; this.fetchImpl = fetchImpl; this.driver = 'supabase'; }
  definition(kind) { if (!definitions[kind]) throw new Error('Unknown entry type'); return definitions[kind]; }
  async request(table, query = '', { method = 'GET', body, prefer = 'return=representation' } = {}) {
    const response = await this.fetchImpl(`${this.settings.url}/rest/v1/${table}${query}`, {
      method, headers: { apikey: this.settings.publishableKey, 'x-english-shelf-access-token': this.accessToken, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: prefer },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase Data APIエラー（HTTP ${response.status}）${text ? `: ${text.slice(0, 240)}` : ''}`);
    return text ? JSON.parse(text) : [];
  }
  async all(table, order = 'id.asc') { return this.request(table, `?select=*&order=${order}`); }
  async nextId(table) { const rows = await this.request(table, '?select=id&order=id.desc&limit=1'); return rows.length ? Number(rows[0].id) + 1 : 1; }
  async list(kind, query = '') {
    const { table, fields } = this.definition(kind); const rows = await this.all(table, 'updated_at.desc,id.desc'); const term = String(query || '').trim().toLocaleLowerCase();
    if (!term) return rows;
    const searchable = [...fields, 'source_body'];
    return rows.filter(row => searchable.some(field => String(row[field] ?? '').toLocaleLowerCase().includes(term))).sort((a, b) => kind === 'words' && String(a.vocabulary).toLocaleLowerCase().startsWith(term) !== String(b.vocabulary).toLocaleLowerCase().startsWith(term) ? (String(a.vocabulary).toLocaleLowerCase().startsWith(term) ? -1 : 1) : 0);
  }
  async get(kind, id) { return (await this.request(this.definition(kind).table, `?select=*&id=eq.${Number(id)}&limit=1`))[0] || null; }
  async save(kind, payload) {
    const { table, fields, required } = this.definition(kind); if (!String(payload[required] || '').trim()) throw new Error('タイトル項目を入力してください');
    const now = new Date().toISOString(), data = Object.fromEntries(fields.map(field => [field, field === 'forgetting_level' ? (payload[field] === '' || payload[field] == null ? null : Number(payload[field])) : String(payload[field] ?? '').trim()]));
    if (payload.id) { data.updated_at = now; await this.request(table, `?id=eq.${Number(payload.id)}`, { method: 'PATCH', body: data }); return this.get(kind, payload.id); }
    data.id = await this.nextId(table); data.source_body = String(payload.source_body || ''); data.notion_page_id = payload.notion_page_id || null; data.notion_url = payload.notion_url || null; data.created_at = now; data.updated_at = now;
    return (await this.request(table, '', { method: 'POST', body: data }))[0];
  }
  async importNotion(kind, sourceRows, bodies = {}) {
    const current = await this.list(kind), known = new Set(current.map(row => row.notion_page_id).filter(Boolean)); let added = 0;
    for (const row of sourceRows) { const url = row.url, pageId = notionPageId(url); if (known.has(pageId)) continue; const word = kind === 'words'; await this.save(kind, word ? { vocabulary: row['単語'], inflection: row['変形'], meaning: row['意味'], example: row['例文'], last_reviewed_at: row['date:最終復習日:start'], forgetting_level: row['忘却レベル'], notion_page_id: pageId, notion_url: url, source_body: bodies[url] || '' } : { title: row['英文・文法'], meaning: row['意味'], similar_sentences: row['類似の英文'], last_reviewed_at: row['date:最終復習日:start'], forgetting_level: row['忘却レベル'], notion_page_id: pageId, notion_url: url, source_body: bodies[url] || '' }); added += 1; }
    return added;
  }
  async due(kind, now = new Date()) { return (await this.list(kind)).filter(row => { if (!row.last_reviewed_at) return true; const reviewed = new Date(row.last_reviewed_at).getTime(), level = Number(row.forgetting_level) || 1; return !Number.isFinite(reviewed) || reviewed + intervals[level] <= now.getTime(); }); }
  async review(kind, id, result, now = new Date()) { const row = await this.get(kind, id); if (!row) throw new Error('Entry not found'); let level = Number(row.forgetting_level) || 1; if (result === 'easy') level = Math.min(8, level + 1); if (result === 'hard') level = Math.max(1, level - 1); return this.save(kind, { ...row, forgetting_level: level, last_reviewed_at: now.toISOString() }); }
  async listCurriculumUnits() {
    const [units, sentences, relations, logs] = await Promise.all([this.all('english_shelf_curriculum_units', 'sort_order.asc,id.asc'), this.all('english_shelf_sentences'), this.all('english_shelf_curriculum_unit_grammar_items', 'unit_id.asc,grammar_item_id.asc'), this.all('english_shelf_study_logs', 'recorded_at.desc,id.desc')]);
    return units.map(unit => { const { basics_text, rules, examples, practice, reference_links, ...summary } = unit; const ids = new Set(relations.filter(r => Number(r.unit_id) === Number(unit.id)).map(r => Number(r.grammar_item_id))); return { ...summary, details: { basics: basics_text, rules: rules || [], examples: examples || [], practice: practice || [], references: reference_links || [] }, grammar_items: sentences.filter(s => ids.has(Number(s.id))), study_logs: logs.filter(l => Number(l.curriculum_unit_id) === Number(unit.id)).map(({ user_note, curriculum_unit_id, created_at, ...log }) => log) }; });
  }
  async getCurriculumUnit(id) { return (await this.listCurriculumUnits()).find(row => Number(row.id) === Number(id)) || null; }
  async saveCurriculumDetails(id, details) { if (!await this.getCurriculumUnit(id)) throw new Error('単元が見つかりません'); await this.request('english_shelf_curriculum_units', `?id=eq.${Number(id)}`, { method: 'PATCH', body: { basics_text: String(details.basics || '').trim(), rules: details.rules || [], examples: details.examples || [], practice: details.practice || [], reference_links: details.references || [], updated_at: new Date().toISOString() } }); return this.getCurriculumUnit(id); }
  async updateCurriculumMastery(id, input) { const value = input.correct_answers !== undefined ? Number(input.correct_answers) * 10 : Number(input.mastery_percent); if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error('理解度は0〜100の整数で指定してください'); await this.request('english_shelf_curriculum_units', `?id=eq.${Number(id)}`, { method: 'PATCH', body: { mastery_percent: value, updated_at: new Date().toISOString() } }); return this.getCurriculumUnit(id); }
  async saveCurriculumUnit(payload) {
    const title = String(payload.title || '').trim(); if (!title) throw new Error('単元タイトルを入力してください'); const existing = payload.id ? await this.getCurriculumUnit(payload.id) : null; const now = new Date().toISOString();
    if (payload.id && !existing) throw new Error('単元が見つかりません');
    const data = { title, learning_objective: String(payload.learning_objective ?? existing?.learning_objective ?? '').trim(), sort_order: Number(payload.sort_order ?? existing?.sort_order ?? ((await this.listCurriculumUnits()).length + 1)), status: statuses.has(payload.status) ? payload.status : existing?.status || '未着手', updated_at: now };
    if (existing) { await this.request('english_shelf_curriculum_units', `?id=eq.${Number(payload.id)}`, { method: 'PATCH', body: data }); return this.getCurriculumUnit(payload.id); }
    Object.assign(data, { id: await this.nextId('english_shelf_curriculum_units'), basics_text: '', rules: [], examples: [], practice: [], reference_links: [], mastery_percent: 0, created_at: now }); return (await this.request('english_shelf_curriculum_units', '', { method: 'POST', body: data }))[0];
  }
  async moveCurriculumUnit(id, direction) { const units = await this.listCurriculumUnits(), index = units.findIndex(u => Number(u.id) === Number(id)), target = direction === 'up' ? index - 1 : index + 1; if (index < 0 || target < 0 || target >= units.length) return this.getCurriculumUnit(id); await this.request('english_shelf_curriculum_units', `?id=eq.${units[index].id}`, { method: 'PATCH', body: { sort_order: units[target].sort_order } }); await this.request('english_shelf_curriculum_units', `?id=eq.${units[target].id}`, { method: 'PATCH', body: { sort_order: units[index].sort_order } }); return this.getCurriculumUnit(id); }
  async reorderCurriculumUnits(ids) { const units = await this.listCurriculumUnits(); if (ids.length !== units.length || new Set(ids.map(Number)).size !== units.length) throw new Error('すべての単元IDを重複なく指定してください'); for (let i = 0; i < ids.length; i += 1) await this.request('english_shelf_curriculum_units', `?id=eq.${Number(ids[i])}`, { method: 'PATCH', body: { sort_order: i + 1 } }); return this.listCurriculumUnits(); }
  async linkGrammarItem(unitId, grammarItemId) { await this.request('english_shelf_curriculum_unit_grammar_items', '', { method: 'POST', body: { unit_id: Number(unitId), grammar_item_id: Number(grammarItemId) }, prefer: 'resolution=ignore-duplicates,return=representation' }); return this.getCurriculumUnit(unitId); }
  async unlinkGrammarItem(unitId, grammarItemId) { await this.request('english_shelf_curriculum_unit_grammar_items', `?unit_id=eq.${Number(unitId)}&grammar_item_id=eq.${Number(grammarItemId)}`, { method: 'DELETE' }); return this.getCurriculumUnit(unitId); }
  async listStudyLogs() { const [logs, units] = await Promise.all([this.all('english_shelf_study_logs', 'recorded_at.desc,id.desc'), this.all('english_shelf_curriculum_units')]); return logs.map(log => ({ ...log, curriculum_unit_title: units.find(u => Number(u.id) === Number(log.curriculum_unit_id))?.title || null })); }
  async getStudyLog(id) { return (await this.listStudyLogs()).find(row => Number(row.id) === Number(id)) || null; }
  async createStudyLog(input, now = new Date()) { const title = String(input.title || '').trim(), summary = String(input.summary || '').trim(); if (!title || !summary) throw new Error('記録タイトルと学習要約を入力してください'); const data = { id: await this.nextId('english_shelf_study_logs'), recorded_at: now.toISOString(), title, summary, mastery_note: String(input.mastery_note || '').trim(), user_note: '', curriculum_unit_id: input.curriculum_unit_id === '' || input.curriculum_unit_id == null ? null : Number(input.curriculum_unit_id), created_at: now.toISOString() }; return (await this.request('english_shelf_study_logs', '', { method: 'POST', body: data }))[0]; }
  async updateStudyLogNote(id, note) { await this.request('english_shelf_study_logs', `?id=eq.${Number(id)}`, { method: 'PATCH', body: { user_note: String(note || '').trim() } }); return this.getStudyLog(id); }
  async counts() { return { words: (await this.all('english_shelf_words')).length, sentences: (await this.all('english_shelf_sentences')).length }; }
  close() {}
}

module.exports = { SupabaseDataStore };
