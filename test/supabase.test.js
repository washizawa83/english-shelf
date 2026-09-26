const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateSupabaseSettings, createSupabaseSettingsStore, checkSupabaseConnection
} = require('../src/supabase-settings');
const {
  createMigrationPayload, verificationView, createSetupSql, migrateToSupabase
} = require('../src/supabase-migration');

const publishableKey = `sb_publishable_${'a'.repeat(24)}`;

test('Supabase settings accept only an HTTPS URL and publishable key', () => {
  assert.deepEqual(validateSupabaseSettings({ url: 'https://demo.supabase.co/', publishableKey }), { url: 'https://demo.supabase.co', publishableKey });
  assert.deepEqual(validateSupabaseSettings({ url: '"https://demo.supabase.co/rest/v1/"', publishableKey }), { url: 'https://demo.supabase.co', publishableKey });
  assert.throws(() => validateSupabaseSettings({ url: 'http://demo.supabase.co', publishableKey }), /HTTPS/);
  assert.throws(() => validateSupabaseSettings({ url: 'https://demo.supabase.co', publishableKey: 'sb_secret_forbidden_value' }), /Secret Key/);
  assert.throws(() => validateSupabaseSettings({ url: 'https://demo.supabase.co', publishableKey: 'service_role' }), /Service Role/);
});

test('local settings persist only the two allowlisted fields', () => {
  let stored = '';
  const fileSystem = { existsSync: () => Boolean(stored), readFileSync: () => stored, mkdirSync: () => {}, writeFileSync: (_name, value) => { stored = value; } };
  const store = createSupabaseSettingsStore('C:/settings-test', { fileSystem });
  const result = store.save({ url: 'https://demo.supabase.co', publishableKey, serviceRoleKey: 'must-not-persist', password: 'must-not-persist' });
  assert.deepEqual(Object.keys(result), ['url', 'publishableKey']);
  assert.equal(stored.includes('serviceRoleKey'), false);
  assert.equal(stored.includes('password'), false);
  assert.deepEqual(store.load(), result);
});

test('connection check performs a read-only Data API request', async () => {
  let request;
  const result = await checkSupabaseConnection({ url: 'https://demo.supabase.co', publishableKey }, { fetchImpl: async (url, options) => {
    request = { url, options }; return { ok: true, status: 200 };
  } });
  assert.equal(request.url, 'https://demo.supabase.co/rest/v1/__english_shelf_connection_probe__?select=id&limit=0');
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers.apikey, publishableKey);
  assert.equal(result.ok, true);
});

test('connection check treats a PostgREST missing-table response as a successful safe probe', async () => {
  const result = await checkSupabaseConnection({ url: 'https://demo.supabase.co/rest/v1/', publishableKey }, { fetchImpl: async () => ({
    ok: false, status: 404, text: async () => JSON.stringify({ code: 'PGRST205', message: 'table not found' })
  }) });
  assert.equal(result.ok, true);
  assert.match(result.message, /HTTP 404 \/ PGRST205/);
});

test('connection errors expose status and actionable causes without blaming CORS', async () => {
  await assert.rejects(
    checkSupabaseConnection({ url: 'https://demo.supabase.co', publishableKey }, { fetchImpl: async () => ({ ok: false, status: 401, text: async () => '{}' }) }),
    /HTTP 401.*別プロジェクト/
  );
  await assert.rejects(
    checkSupabaseConnection({ url: 'https://demo.supabase.co', publishableKey }, { fetchImpl: async () => ({ ok: false, status: 404, text: async () => '<html>not found<\/html>' }) }),
    /HTTP 404.*Data API/
  );
  await assert.rejects(
    checkSupabaseConnection({ url: 'https://demo.supabase.co', publishableKey }, { fetchImpl: async () => { throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }); } }),
    /ENOTFOUND.*CORS設定は原因になりません/
  );
});

test('migration payload keeps ids, relations, and every data group', async () => {
  const service = {
    list: async kind => kind === 'words' ? [{ id: 1, vocabulary: 'hello', inflection: '', meaning: 'こんにちは', example: '', forgetting_level: '', source_body: '', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }] : [{ id: 2, title: 'Hello.', meaning: 'こんにちは。', similar_sentences: '', forgetting_level: '3', source_body: '', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }],
    listCurriculumUnits: async () => [{ id: 3, title: 'Unit', learning_objective: 'Goal', sort_order: 1, status: '未着手', mastery_percent: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', details: { basics: 'Basic', rules: [], examples: [], practice: [], references: [] }, grammar_items: [{ id: 2 }] }],
    listStudyLogs: async () => [{ id: 4, recorded_at: '2026-01-01', title: 'Log', summary: 'Done', mastery_note: '', user_note: '', curriculum_unit_id: '', created_at: '2026-01-01T00:00:00Z' }]
  };
  const payload = await createMigrationPayload(service);
  assert.deepEqual(payload.curriculum_unit_grammar_items, [{ unit_id: 3, grammar_item_id: 2 }]);
  assert.equal(payload.words[0].forgetting_level, null);
  assert.equal(payload.sentences[0].forgetting_level, 3);
  assert.equal(payload.study_logs[0].curriculum_unit_id, null);
  assert.deepEqual(Object.fromEntries(Object.entries(payload).map(([key, rows]) => [key, rows.length])), { words: 1, sentences: 1, curriculum_units: 1, curriculum_unit_grammar_items: 1, study_logs: 1 });
});

test('migration verification canonicalizes SQLite display order to server id order', () => {
  const view = verificationView({
    words: [{ id: 30, vocabulary: 'z' }, { id: 1, vocabulary: 'a' }],
    sentences: [{ id: 8 }, { id: 2 }], curriculum_units: [{ id: 6 }, { id: 5 }],
    curriculum_unit_grammar_items: [{ unit_id: 6, grammar_item_id: 8 }, { unit_id: 5, grammar_item_id: 2 }],
    study_logs: [{ id: 3 }, { id: 2 }]
  });
  assert.deepEqual(view.words.map(row => row[0]), [1, 30]);
  assert.deepEqual(view.sentences.map(row => row[0]), [2, 8]);
  assert.deepEqual(view.curriculum_units.map(row => row[0]), [5, 6]);
  assert.deepEqual(view.curriculum_unit_grammar_items.map(row => row.slice(0, 2)), [[5, 2], [6, 8]]);
  assert.deepEqual(view.study_logs.map(row => row[0]), [2, 3]);
});

test('setup SQL uses RLS and a hashed one-time token, and migration verifies content', async () => {
  const token = 'one-time-token';
  const sql = createSetupSql(token);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all .* from anon, authenticated/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /nullif\(forgetting_level,''\)::integer/);
  assert.match(sql, /nullif\(curriculum_unit_id,''\)::bigint/);
  assert.equal(sql.includes(token), false);
  const payload = { words: [], sentences: [], curriculum_units: [], curriculum_unit_grammar_items: [], study_logs: [] };
  const result = await migrateToSupabase({ url: 'https://demo.supabase.co', publishableKey }, token, payload, { fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.p_token, token);
    return { ok: true, status: 200, json: async () => verificationView(payload), text: async () => '' };
  } });
  assert.equal(result.localHash, result.remoteHash);
});

test('renderer exposes settings, connection verification, and explicit migration confirmation', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'App.jsx'), 'utf8');
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  assert.match(appSource, /<h3>Data API<\/h3>/);
  assert.doesNotMatch(appSource, /<h2>Supabase接続設定<\/h2>/);
  assert.match(appSource, /DBパスワード、Secret Key、Service Role Keyは受け付けません/);
  assert.match(appSource, /ローカルSQLiteは削除・上書きされません/);
  assert.match(mainSource, /settings:supabase:check/);
  assert.match(mainSource, /migration:supabase:run/);
});
