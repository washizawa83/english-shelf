const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupabaseRuntimeStore, createSupabaseAccessSql } = require('../src/supabase-runtime');
const { SupabaseDataStore } = require('../src/data-store/supabase');

const settings = { url: 'https://demo.supabase.co', publishableKey: `sb_publishable_${'a'.repeat(24)}` };

test('runtime state defaults to SQLite and persists explicit Supabase selection separately', () => {
  let stored = '';
  const fileSystem = { existsSync: () => Boolean(stored), readFileSync: () => stored, mkdirSync: () => {}, writeFileSync: (_file, value) => { stored = value; } };
  const runtime = createSupabaseRuntimeStore('C:/runtime-test', { fileSystem });
  assert.equal(runtime.load().activeStore, 'sqlite');
  runtime.save({ activeStore: 'supabase', accessToken: 'device-token', verification: { hash: 'same' } });
  assert.deepEqual(runtime.load(), { activeStore: 'supabase', accessToken: 'device-token', verification: { hash: 'same' } });
});

test('access SQL keeps raw device token out and protects tables with RLS', () => {
  const token = 'private-device-token';
  const sql = createSupabaseAccessSql(token);
  assert.equal(sql.includes(token), false);
  assert.match(sql, /english_shelf_access_gates/);
  assert.match(sql, /english_shelf_has_access/);
  assert.match(sql, /x-english-shelf-access-token/);
  assert.match(sql, /create policy english_shelf_device_access/);
  assert.match(sql, /grant select, insert, update, delete/);
});

test('Supabase adapter sends publishable and device keys and supports reads and writes', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (options.method === 'GET' && url.includes('order=id.desc')) return { ok: true, status: 200, text: async () => '[{"id":31}]' };
    if (options.method === 'POST') return { ok: true, status: 201, text: async () => `[${options.body}]` };
    if (options.method === 'PATCH') return { ok: true, status: 200, text: async () => `[${options.body}]` };
    if (url.includes('id=eq.32')) return { ok: true, status: 200, text: async () => '[{"id":32,"vocabulary":"new","forgetting_level":1}]' };
    return { ok: true, status: 200, text: async () => '[]' };
  };
  const store = new SupabaseDataStore(settings, 'device-token', { fetchImpl });
  await store.save('words', { vocabulary: 'new', forgetting_level: 1 });
  assert.ok(requests.some(request => request.options.method === 'POST'));
  assert.ok(requests.every(request => request.options.headers.apikey === settings.publishableKey));
  assert.ok(requests.every(request => request.options.headers['x-english-shelf-access-token'] === 'device-token'));
});

test('Supabase adapter orders composite-key relations without referencing an id column', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, text: async () => '[]' };
  };
  const store = new SupabaseDataStore(settings, 'device-token', { fetchImpl });
  await store.all('english_shelf_curriculum_unit_grammar_items');
  assert.match(requests[0].url, /order=unit_id\.asc,grammar_item_id\.asc/);
  assert.doesNotMatch(requests[0].url, /order=id(?:\.|&|$)/);

  await store.linkGrammarItem(7, 9);
  await store.unlinkGrammarItem(7, 9);
  const link = requests.find(request => request.options.method === 'POST' && request.url.includes('english_shelf_curriculum_unit_grammar_items'));
  const unlink = requests.find(request => request.options.method === 'DELETE' && request.url.includes('english_shelf_curriculum_unit_grammar_items'));
  assert.deepEqual(JSON.parse(link.options.body), { unit_id: 7, grammar_item_id: 9 });
  assert.match(unlink.url, /unit_id=eq\.7&grammar_item_id=eq\.9/);
  assert.doesNotMatch(unlink.url, /[?&]id=/);
});

test('desktop and MCP share the persisted data-store selection', () => {
  const fs = require('node:fs'), path = require('node:path');
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const mcp = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'english-shelf', 'server', 'index.js'), 'utf8');
  assert.match(main, /createSelectedDataStore/);
  assert.match(main, /data-store:supabase:enable/);
  assert.match(mcp, /createSelectedDataStore/);
  assert.match(mcp, /supabase-runtime\.json/);
});
