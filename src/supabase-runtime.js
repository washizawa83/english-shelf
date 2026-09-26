const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RUNTIME_FILENAME = 'supabase-runtime.json';

function createSupabaseRuntimeStore(userDataPath, { fileSystem = fs } = {}) {
  const filename = path.join(userDataPath, RUNTIME_FILENAME);
  const defaults = { activeStore: 'sqlite', accessToken: '', verification: null };
  return {
    filename,
    load() {
      if (!fileSystem.existsSync(filename)) return { ...defaults };
      try {
        const value = JSON.parse(fileSystem.readFileSync(filename, 'utf8'));
        return { activeStore: value.activeStore === 'supabase' ? 'supabase' : 'sqlite', accessToken: String(value.accessToken || ''), verification: value.verification || null };
      } catch { return { ...defaults }; }
    },
    save(value) {
      const safe = { activeStore: value.activeStore === 'supabase' ? 'supabase' : 'sqlite', accessToken: String(value.accessToken || ''), verification: value.verification || null };
      fileSystem.mkdirSync(userDataPath, { recursive: true });
      fileSystem.writeFileSync(filename, `${JSON.stringify(safe, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      return safe;
    }
  };
}

function createAccessToken() { return crypto.randomBytes(32).toString('hex'); }

function createSupabaseAccessSql(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const tables = ['english_shelf_words', 'english_shelf_sentences', 'english_shelf_curriculum_units', 'english_shelf_curriculum_unit_grammar_items', 'english_shelf_study_logs'];
  const policies = tables.map(table => `drop policy if exists english_shelf_device_access on public.${table};\ncreate policy english_shelf_device_access on public.${table} for all to anon using (public.english_shelf_has_access()) with check (public.english_shelf_has_access());`).join('\n');
  return `-- English Shelf: enable this device to read/write through RLS\n-- Run once in Supabase Dashboard > SQL Editor. Keep this script private.\ncreate extension if not exists pgcrypto with schema extensions;\ncreate table if not exists public.english_shelf_access_gates (token_hash text primary key, created_at timestamptz not null default now(), revoked_at timestamptz);\nalter table public.english_shelf_access_gates enable row level security;\nrevoke all on public.english_shelf_access_gates from anon, authenticated;\ninsert into public.english_shelf_access_gates(token_hash, revoked_at) values ('${hash}', null) on conflict (token_hash) do update set revoked_at = null;\ncreate or replace function public.english_shelf_has_access() returns boolean language sql stable security definer set search_path = public, pg_temp as $$\n  select exists (select 1 from public.english_shelf_access_gates where token_hash = encode(extensions.digest(convert_to(coalesce((coalesce(nullif(current_setting('request.headers', true),''),'{}')::json->>'x-english-shelf-access-token'),''), 'UTF8'), 'sha256'), 'hex') and revoked_at is null)\n$$;\nrevoke all on function public.english_shelf_has_access() from public;\ngrant execute on function public.english_shelf_has_access() to anon;\ngrant select, insert, update, delete on ${tables.map(table => `public.${table}`).join(', ')} to anon;\n${policies}\n`;
}

module.exports = { RUNTIME_FILENAME, createSupabaseRuntimeStore, createAccessToken, createSupabaseAccessSql };
