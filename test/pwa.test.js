const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadWebApi({ settings, runtime, rows = {}, deviceAccess = true }) {
  const root = path.join(__dirname, '..');
  const storage = new Map([
    ['english-shelf:supabase-settings', JSON.stringify(settings)],
    ['english-shelf:supabase-runtime', JSON.stringify(runtime)]
  ]);
  const requests = [];
  const source = fs.readFileSync(path.join(root, 'src', 'renderer', 'web-api.js'), 'utf8')
    .replaceAll('import.meta.env', '__viteEnv')
    .replace('export default webApi;', 'globalThis.__webApi = webApi;');
  const context = {
    __viteEnv: {},
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      if (new URL(url).pathname.endsWith('/rpc/english_shelf_has_access')) return { ok: true, status: 200, text: async () => JSON.stringify(deviceAccess) };
      const table = new URL(url).pathname.split('/').pop();
      return { ok: true, status: 200, text: async () => JSON.stringify(rows[table] || []) };
    },
    URL,
    console
  };
  vm.runInNewContext(source, context);
  return { api: context.__webApi, requests, storage };
}

test('PWA manifest, offline shell, iPhone metadata, and Vercel SPA config are present', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'public', 'service-worker.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.ok(manifest.icons.every(icon => icon.type === 'image/png'));
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /favicon-32\.png/);
  assert.match(main, /icon-512\.png/);
  assert.match(worker, /caches\.open/);
  assert.deepEqual(vercel.rewrites, [{ source: '/(.*)', destination: '/index.html' }]);
});

test('web bridge uses only public Supabase settings and hides desktop-only migration', () => {
  const root = path.join(__dirname, '..');
  const webApi = fs.readFileSync(path.join(root, 'src', 'renderer', 'web-api.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'renderer', 'App.jsx'), 'utf8');
  assert.match(webApi, /VITE_SUPABASE_URL/);
  assert.match(webApi, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(webApi, /service.role|sb_secret|database.password/i);
  assert.match(webApi, /english_shelf_curriculum_unit_grammar_items: 'unit_id\.asc,grammar_item_id\.asc'/);
  assert.match(webApi, /all\('english_shelf_curriculum_unit_grammar_items', 'unit_id\.asc,grammar_item_id\.asc'\)/);
  assert.match(app, /!isWeb && <section className="settings-card migration-card"/);
  assert.match(app, /id="access-verification-status"/);
  assert.match(app, /確認中…/);
});

test('web bridge preserves an existing iPhone authorization and loads every summary data group', async () => {
  const settings = { url: 'https://demo.supabase.co', publishableKey: `sb_publishable_${'a'.repeat(24)}` };
  const verification = { counts: { words: 31, sentences: 8, curriculum_units: 28, curriculum_unit_grammar_items: 0, study_logs: 2 } };
  const rows = {
    english_shelf_words: Array.from({ length: 31 }, (_, id) => ({ id: id + 1 })),
    english_shelf_sentences: Array.from({ length: 8 }, (_, id) => ({ id: id + 1 })),
    english_shelf_curriculum_units: Array.from({ length: 28 }, (_, id) => ({ id: id + 1, rules: [], examples: [], practice: [], reference_links: [] })),
    english_shelf_curriculum_unit_grammar_items: [],
    english_shelf_study_logs: Array.from({ length: 2 }, (_, id) => ({ id: id + 1, curriculum_unit_id: 1 }))
  };
  const { api, requests, storage } = loadWebApi({ settings, runtime: { activeStore: 'supabase', accessToken: 'existing-device-token', verification }, rows });
  assert.equal(api.initialView, 'summary');
  await api.saveSupabaseSettings({ ...settings, url: `${settings.url}/` });
  assert.deepEqual(JSON.parse(storage.get('english-shelf:supabase-runtime')), { activeStore: 'supabase', accessToken: 'existing-device-token', verification });
  const status = await api.getDataStoreStatus();
  assert.equal(status.activeStore, 'supabase');
  assert.equal(status.diagnostics.accessAuthorized, true);
  const [words, sentences, units, logs] = await Promise.all([api.list('words', ''), api.list('sentences', ''), api.listCurriculum(), api.listStudyLogs()]);
  assert.deepEqual([words.length, sentences.length, units.length, logs.length], [31, 8, 28, 2]);
  assert.ok(requests.every(request => request.options.headers['x-english-shelf-access-token'] === 'existing-device-token'));
  assert.ok(requests.some(request => request.url.endsWith('/rpc/english_shelf_has_access')));
  assert.ok(requests.some(request => request.url.includes('english_shelf_curriculum_unit_grammar_items?select=*&order=unit_id.asc,grammar_item_id.asc')));
});

test('web bridge does not show a broken active state as an empty summary', async () => {
  const settings = { url: 'https://demo.supabase.co', publishableKey: `sb_publishable_${'b'.repeat(24)}` };
  const verification = { counts: { words: 31, sentences: 8, curriculum_units: 28, curriculum_unit_grammar_items: 0, study_logs: 2 } };
  const missingToken = loadWebApi({ settings, runtime: { activeStore: 'supabase', accessToken: '', verification } });
  assert.equal(missingToken.api.initialView, 'settings');
  const status = await missingToken.api.getDataStoreStatus();
  assert.equal(status.activeStore, 'setup');
  assert.equal(status.migrationVerified, true);
  assert.equal(status.needsReauthorization, true);

  const inaccessible = loadWebApi({ settings, runtime: { activeStore: 'supabase', accessToken: 'stale-token', verification }, deviceAccess: false });
  const inaccessibleStatus = await inaccessible.api.getDataStoreStatus();
  assert.equal(inaccessibleStatus.activeStore, 'setup');
  assert.equal(inaccessibleStatus.needsReauthorization, true);
  assert.equal(inaccessibleStatus.diagnostics.accessAuthorized, false);
  await assert.rejects(() => inaccessible.api.verifySupabaseData(), /RLSで承認されていません/);
});

test('web bridge reuses an authorized pending token after PWA reload without another SQL run', async () => {
  const settings = { url: 'https://demo.supabase.co', publishableKey: `sb_publishable_${'c'.repeat(24)}` };
  const rows = {
    english_shelf_words: Array.from({ length: 31 }, (_, id) => ({ id: id + 1 })),
    english_shelf_sentences: Array.from({ length: 8 }, (_, id) => ({ id: id + 1 })),
    english_shelf_curriculum_units: Array.from({ length: 28 }, (_, id) => ({ id: id + 1 })),
    english_shelf_curriculum_unit_grammar_items: [],
    english_shelf_study_logs: Array.from({ length: 2 }, (_, id) => ({ id: id + 1 }))
  };
  const pending = loadWebApi({ settings, runtime: { activeStore: 'setup', accessToken: 'authorized-pending-token', verification: null }, rows, deviceAccess: true });
  const status = await pending.api.getDataStoreStatus();
  assert.equal(status.activeStore, 'setup');
  assert.equal(status.diagnostics.accessAuthorized, true);
  const verified = await pending.api.verifySupabaseData();
  assert.deepEqual(Array.from(Object.values(verified.counts)), [31, 8, 28, 0, 2]);
  assert.equal(JSON.parse(pending.storage.get('english-shelf:supabase-runtime')).accessToken, 'authorized-pending-token');
});
