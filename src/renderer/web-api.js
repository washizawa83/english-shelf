const SETTINGS_KEY = 'english-shelf:supabase-settings';
const RUNTIME_KEY = 'english-shelf:supabase-runtime';
const tables = { words: 'english_shelf_words', sentences: 'english_shelf_sentences' };
const defaultOrders = {
  english_shelf_words: 'id.asc',
  english_shelf_sentences: 'id.asc',
  english_shelf_curriculum_units: 'sort_order.asc,id.asc',
  english_shelf_curriculum_unit_grammar_items: 'unit_id.asc,grammar_item_id.asc',
  english_shelf_study_logs: 'recorded_at.desc,id.desc'
};
const reviewIntervals = {
  1: 20 * 60 * 1000,
  2: 60 * 60 * 1000,
  3: 9 * 60 * 60 * 1000,
  4: 24 * 60 * 60 * 1000,
  5: 2 * 24 * 60 * 60 * 1000,
  6: 6 * 24 * 60 * 60 * 1000,
  7: 30 * 24 * 60 * 60 * 1000,
  8: 182 * 24 * 60 * 60 * 1000
};
const envSettings = { url: import.meta.env.VITE_SUPABASE_URL || '', publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '' };

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function settings() { const local = readJson(SETTINGS_KEY, {}); return { url: local.url || envSettings.url, publishableKey: local.publishableKey || envSettings.publishableKey }; }
function runtime() { return readJson(RUNTIME_KEY, { activeStore: 'setup', accessToken: '', verification: null }); }
function saveRuntime(value) { localStorage.setItem(RUNTIME_KEY, JSON.stringify(value)); return value; }
function hasUsableRuntime(state = runtime()) { return state.activeStore === 'supabase' && Boolean(state.accessToken); }
function normalizeUrl(value) { return String(value || '').trim().replace(/^(['"])(.*)\1$/, '$2').replace(/\/+$/, '').replace(/\/rest\/v1$/i, ''); }
function validate(input) { const url = normalizeUrl(input?.url), publishableKey = String(input?.publishableKey || '').trim(); if (!url || !publishableKey) throw new Error('Supabase URLとPublishable Keyを入力してください。'); if (!/^https:\/\//.test(url)) throw new Error('Supabase URLはHTTPSを指定してください。'); if (!/^sb_publishable_[A-Za-z0-9._-]{8,}$/.test(publishableKey)) throw new Error('Publishable Keyは「sb_publishable_」で始まる公開キーを指定してください。'); return { url, publishableKey }; }

async function request(table, query = '', options = {}) {
  const config = validate(settings()), state = runtime();
  if (!state.accessToken) throw new Error('設定画面でSupabase利用SQLを実行してください。');
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, { method: options.method || 'GET', headers: { apikey: config.publishableKey, 'x-english-shelf-access-token': state.accessToken, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation' }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const text = await response.text(); if (!response.ok) throw new Error(`Supabase Data APIエラー（HTTP ${response.status}）${text ? `: ${text.slice(0, 180)}` : ''}`); return text ? JSON.parse(text) : [];
}
async function all(table, order = defaultOrders[table] || '') { return request(table, `?select=*${order ? `&order=${order}` : ''}`); }
async function deviceAccessAuthorized() { return (await request('rpc/english_shelf_has_access', '', { method: 'POST', body: {} })) === true; }
async function nextId(table) { const rows = await request(table, '?select=id&order=id.desc&limit=1'); return rows.length ? Number(rows[0].id) + 1 : 1; }
async function list(kind, query = '') { const rows = await all(tables[kind], 'updated_at.desc,id.desc'), term = String(query).trim().toLocaleLowerCase(); return term ? rows.filter(row => Object.values(row).some(value => String(value ?? '').toLocaleLowerCase().includes(term))) : rows; }
function isReviewDue(row, now = new Date()) {
  if (!row.last_reviewed_at) return true;
  const reviewedAt = new Date(row.last_reviewed_at).getTime();
  if (!Number.isFinite(reviewedAt)) return true;
  const numericLevel = Number(row.forgetting_level);
  const level = Number.isInteger(numericLevel) && numericLevel >= 1 && numericLevel <= 8 ? numericLevel : 1;
  return reviewedAt + reviewIntervals[level] <= now.getTime();
}
async function get(kind, id) { return (await request(tables[kind], `?select=*&id=eq.${Number(id)}&limit=1`))[0] || null; }
async function save(kind, payload) {
  const word = kind === 'words', required = word ? 'vocabulary' : 'title'; if (!String(payload[required] || '').trim()) throw new Error('タイトル項目を入力してください。');
  const fields = word ? ['vocabulary', 'inflection', 'meaning', 'example', 'last_reviewed_at', 'forgetting_level'] : ['title', 'meaning', 'similar_sentences', 'last_reviewed_at', 'forgetting_level'];
  const now = new Date().toISOString(), data = Object.fromEntries(fields.map(field => [field, field === 'forgetting_level' ? (payload[field] === '' || payload[field] == null ? null : Number(payload[field])) : String(payload[field] ?? '').trim()]));
  if (payload.id) { data.updated_at = now; await request(tables[kind], `?id=eq.${Number(payload.id)}`, { method: 'PATCH', body: data }); return get(kind, payload.id); }
  Object.assign(data, { id: await nextId(tables[kind]), notion_page_id: null, notion_url: null, source_body: '', created_at: now, updated_at: now }); return (await request(tables[kind], '', { method: 'POST', body: data }))[0];
}
async function listCurriculum() {
  const [units, sentences, relations, logs] = await Promise.all([all('english_shelf_curriculum_units', 'sort_order.asc,id.asc'), all('english_shelf_sentences'), all('english_shelf_curriculum_unit_grammar_items', 'unit_id.asc,grammar_item_id.asc'), all('english_shelf_study_logs', 'recorded_at.desc,id.desc')]);
  return units.map(unit => { const ids = new Set(relations.filter(r => Number(r.unit_id) === Number(unit.id)).map(r => Number(r.grammar_item_id))); const { basics_text, rules, examples, practice, reference_links, ...summary } = unit; return { ...summary, details: { basics: basics_text, rules: rules || [], examples: examples || [], practice: practice || [], references: reference_links || [] }, grammar_items: sentences.filter(row => ids.has(Number(row.id))), study_logs: logs.filter(row => Number(row.curriculum_unit_id) === Number(unit.id)) }; });
}
async function listStudyLogs() { const [logs, units] = await Promise.all([all('english_shelf_study_logs', 'recorded_at.desc,id.desc'), all('english_shelf_curriculum_units')]); return logs.map(log => ({ ...log, curriculum_unit_title: units.find(unit => Number(unit.id) === Number(log.curriculum_unit_id))?.title || null })); }
async function hashHex(value) { const bytes = new TextEncoder().encode(value), digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
async function accessSql(token) {
  const hash = await hashHex(token), names = ['english_shelf_words', 'english_shelf_sentences', 'english_shelf_curriculum_units', 'english_shelf_curriculum_unit_grammar_items', 'english_shelf_study_logs'];
  const policies = names.map(name => `drop policy if exists english_shelf_device_access on public.${name};\ncreate policy english_shelf_device_access on public.${name} for all to anon using (public.english_shelf_has_access()) with check (public.english_shelf_has_access());`).join('\n');
  return `-- English Shelf Web device access\ncreate extension if not exists pgcrypto with schema extensions;\ncreate table if not exists public.english_shelf_access_gates (token_hash text primary key, created_at timestamptz not null default now(), revoked_at timestamptz);\nalter table public.english_shelf_access_gates enable row level security;\nrevoke all on public.english_shelf_access_gates from anon, authenticated;\ninsert into public.english_shelf_access_gates(token_hash, revoked_at) values ('${hash}', null) on conflict (token_hash) do update set revoked_at = null;\ncreate or replace function public.english_shelf_has_access() returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select exists (select 1 from public.english_shelf_access_gates where token_hash = encode(extensions.digest(convert_to(coalesce((coalesce(nullif(current_setting('request.headers', true),''),'{}')::json->>'x-english-shelf-access-token'),''), 'UTF8'), 'sha256'), 'hex') and revoked_at is null) $$;\nrevoke all on function public.english_shelf_has_access() from public; grant execute on function public.english_shelf_has_access() to anon;\ngrant select, insert, update, delete on ${names.map(name => `public.${name}`).join(', ')} to anon;\n${policies}`;
}

const webApi = {
  platform: 'web',
  initialView: hasUsableRuntime() ? 'summary' : 'settings',
  async list(kind, query) { if (!hasUsableRuntime()) return []; return list(kind, query); }, get, save,
  async due(kind) { const rows = await list(kind); return rows.filter(row => isReviewDue(row)); },
  async review(kind, id, result) { const row = await get(kind, id); let level = Number(row.forgetting_level) || 1; if (result === 'easy') level = Math.min(8, level + 1); if (result === 'hard') level = Math.max(1, level - 1); return save(kind, { ...row, forgetting_level: level, last_reviewed_at: new Date().toISOString() }); },
  async listCurriculum() { return hasUsableRuntime() ? listCurriculum() : []; },
  async saveCurriculum() { throw new Error('Web画面ではカリキュラムを編集できません。'); }, async moveCurriculum() {}, async linkCurriculumGrammar() {}, async unlinkCurriculumGrammar() {},
  async listStudyLogs() { return hasUsableRuntime() ? listStudyLogs() : []; },
  async getStudyLog(id) { return (await listStudyLogs()).find(row => Number(row.id) === Number(id)) || null; },
  async updateStudyLogNote(id, userNote) { await request('english_shelf_study_logs', `?id=eq.${Number(id)}`, { method: 'PATCH', body: { user_note: String(userNote || '').trim() } }); return this.getStudyLog(id); },
  async getSupabaseSettings() { return settings(); },
  async saveSupabaseSettings(input) { const valid = validate(input), previous = settings(), state = runtime(); localStorage.setItem(SETTINGS_KEY, JSON.stringify(valid)); if (valid.url !== normalizeUrl(previous.url) || valid.publishableKey !== previous.publishableKey) saveRuntime({ activeStore: 'setup', accessToken: '', verification: null }); else saveRuntime(state); return valid; },
  async checkSupabaseConnection(input) { const valid = validate(input), response = await fetch(`${valid.url}/rest/v1/__english_shelf_connection_probe__?select=id&limit=0`, { headers: { apikey: valid.publishableKey, Accept: 'application/json' } }); const text = await response.text(); let detail = {}; try { detail = JSON.parse(text); } catch {} if (response.ok || (response.status === 404 && /^PGRST\d+$/.test(detail.code || ''))) return { ok: true, message: 'URLとPublishable Keyを確認できました。データ表示には、続けて端末認証SQLの実行とSupabaseデータ確認が必要です。' }; throw new Error(`接続確認失敗（HTTP ${response.status}）: URL、Publishable Key、Data API設定を確認してください。`); },
  async prepareSupabaseMigration() { throw new Error('SQLite移行はデスクトップ版で実行してください。'); }, async runSupabaseMigration() { throw new Error('SQLite移行はデスクトップ版で実行してください。'); },
  async getDataStoreStatus() { const state = runtime(), hasToken = Boolean(state.accessToken); let accessAuthorized = null, accessError = ''; if (hasToken) { try { accessAuthorized = await deviceAccessAuthorized(); } catch (error) { accessError = error.message; } } return { activeStore: hasUsableRuntime(state) && accessAuthorized ? 'supabase' : 'setup', migrationVerified: Boolean(state.verification), needsReauthorization: state.activeStore === 'supabase' && (!hasToken || accessAuthorized === false), diagnostics: { runtimeActiveStore: state.activeStore, hasAccessToken: hasToken, accessAuthorized, accessError, verificationCounts: state.verification?.counts || null } }; },
  async prepareSupabaseAccess() { validate(settings()); const token = randomToken(); saveRuntime({ activeStore: 'setup', accessToken: token, verification: null }); return { setupSql: await accessSql(token) }; },
  async verifySupabaseData() { if (!await deviceAccessAuthorized()) throw new Error('このiPhoneの端末トークンはSupabaseのRLSで承認されていません。表示中の端末認証SQLを実行してから再確認してください。'); const [words, sentences, curriculumUnits, curriculumRelations, studyLogs] = await Promise.all([all('english_shelf_words'), all('english_shelf_sentences'), all('english_shelf_curriculum_units'), all('english_shelf_curriculum_unit_grammar_items', 'unit_id.asc,grammar_item_id.asc'), all('english_shelf_study_logs')]); const counts = { words: words.length, sentences: sentences.length, curriculum_units: curriculumUnits.length, curriculum_unit_grammar_items: curriculumRelations.length, study_logs: studyLogs.length }; const state = runtime(), previousTotal = Object.values(state.verification?.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0), currentTotal = Object.values(counts).reduce((sum, value) => sum + value, 0); if (previousTotal > 0 && currentTotal === 0) throw new Error('以前確認したSupabaseデータを取得できません。端末認証SQLとRLS設定を再確認してください。'); saveRuntime({ ...state, verification: { counts, verifiedAt: new Date().toISOString() } }); return { counts }; },
  async enableSupabase() { const checked = await this.verifySupabaseData(); const state = runtime(); saveRuntime({ ...state, activeStore: 'supabase' }); return { activeStore: 'supabase', ...checked }; },
  async enableSqlite() { throw new Error('SQLiteはデスクトップ版専用です。'); }
};

export default webApi;
