const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('PWA manifest, offline shell, iPhone metadata, and Vercel SPA config are present', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.webmanifest'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'public', 'service-worker.js'), 'utf8');
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /apple-touch-icon/);
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
});
