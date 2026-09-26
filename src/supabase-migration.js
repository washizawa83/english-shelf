const crypto = require('node:crypto');
const { validateSupabaseSettings } = require('./supabase-settings');

function cleanRow(row, keys) { return Object.fromEntries(keys.map(key => [key, row[key] ?? null])); }
function nullableInteger(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

async function createMigrationPayload(studyService) {
  const [words, sentences, units, logs] = await Promise.all([
    studyService.list('words', ''), studyService.list('sentences', ''),
    studyService.listCurriculumUnits(), studyService.listStudyLogs()
  ]);
  const relations = units.flatMap(unit => (unit.grammar_items || []).map(item => ({ unit_id: unit.id, grammar_item_id: item.id })));
  return {
    words: words.map(row => ({ ...cleanRow(row, ['id', 'vocabulary', 'inflection', 'meaning', 'example', 'last_reviewed_at', 'notion_page_id', 'notion_url', 'source_body', 'created_at', 'updated_at']), id: Number(row.id), forgetting_level: nullableInteger(row.forgetting_level) })),
    sentences: sentences.map(row => ({ ...cleanRow(row, ['id', 'title', 'meaning', 'similar_sentences', 'last_reviewed_at', 'notion_page_id', 'notion_url', 'source_body', 'created_at', 'updated_at']), id: Number(row.id), forgetting_level: nullableInteger(row.forgetting_level) })),
    curriculum_units: units.map(unit => ({
      ...cleanRow(unit, ['title', 'learning_objective', 'status', 'created_at', 'updated_at']),
      id: Number(unit.id), sort_order: Number(unit.sort_order), mastery_percent: Number(unit.mastery_percent),
      basics_text: unit.details?.basics || '', rules: unit.details?.rules || [], examples: unit.details?.examples || [],
      practice: unit.details?.practice || [], reference_links: unit.details?.references || []
    })),
    curriculum_unit_grammar_items: relations.map(row => ({ unit_id: Number(row.unit_id), grammar_item_id: Number(row.grammar_item_id) })),
    study_logs: logs.map(row => ({ ...cleanRow(row, ['recorded_at', 'title', 'summary', 'mastery_note', 'user_note', 'created_at']), id: Number(row.id), curriculum_unit_id: nullableInteger(row.curriculum_unit_id) }))
  };
}

function verificationView(payload) {
  const byId = (a, b) => Number(a[0]) - Number(b[0]);
  const byRelation = (a, b) => Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1]);
  return {
    words: payload.words.map(r => [r.id, r.vocabulary, r.inflection, r.meaning, r.example, r.last_reviewed_at, r.forgetting_level, r.notion_page_id, r.notion_url, r.source_body]).sort(byId),
    sentences: payload.sentences.map(r => [r.id, r.title, r.meaning, r.similar_sentences, r.last_reviewed_at, r.forgetting_level, r.notion_page_id, r.notion_url, r.source_body]).sort(byId),
    curriculum_units: payload.curriculum_units.map(r => [r.id, r.title, r.learning_objective, r.sort_order, r.status, r.basics_text, r.rules, r.examples, r.practice, r.reference_links, r.mastery_percent]).sort(byId),
    curriculum_unit_grammar_items: payload.curriculum_unit_grammar_items.map(r => [r.unit_id, r.grammar_item_id]).sort(byRelation),
    study_logs: payload.study_logs.map(r => [r.id, r.recorded_at, r.title, r.summary, r.mastery_note, r.user_note, r.curriculum_unit_id]).sort(byId)
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function fingerprint(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function migrationSummary(payload) { return Object.fromEntries(Object.entries(payload).map(([key, rows]) => [key, rows.length])); }
function createMigrationToken() { return crypto.randomBytes(32).toString('hex'); }

function createSetupSql(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return `-- English Shelf: one-time SQLite import bridge (v1)\n-- Run this once in Supabase Dashboard > SQL Editor. Do not share this script.\ncreate extension if not exists pgcrypto with schema extensions;\n\ncreate table if not exists public.english_shelf_words (id bigint primary key, vocabulary text not null, inflection text not null, meaning text not null, example text not null, last_reviewed_at text, forgetting_level integer, notion_page_id text unique, notion_url text, source_body text not null, created_at timestamptz not null, updated_at timestamptz not null);\ncreate table if not exists public.english_shelf_sentences (id bigint primary key, title text not null, meaning text not null, similar_sentences text not null, last_reviewed_at text, forgetting_level integer, notion_page_id text unique, notion_url text, source_body text not null, created_at timestamptz not null, updated_at timestamptz not null);\ncreate table if not exists public.english_shelf_curriculum_units (id bigint primary key, title text not null, learning_objective text not null, sort_order integer not null, status text not null, basics_text text not null, rules jsonb not null, examples jsonb not null, practice jsonb not null, reference_links jsonb not null, mastery_percent integer not null, created_at timestamptz not null, updated_at timestamptz not null);\ncreate table if not exists public.english_shelf_curriculum_unit_grammar_items (unit_id bigint not null references public.english_shelf_curriculum_units(id), grammar_item_id bigint not null references public.english_shelf_sentences(id), primary key(unit_id, grammar_item_id));\ncreate table if not exists public.english_shelf_study_logs (id bigint primary key, recorded_at text not null, title text not null, summary text not null, mastery_note text not null, user_note text not null, curriculum_unit_id bigint references public.english_shelf_curriculum_units(id), created_at timestamptz not null);\ncreate table if not exists public.english_shelf_migration_gates (token_hash text primary key, used_at timestamptz);\n\nalter table public.english_shelf_words enable row level security;\nalter table public.english_shelf_sentences enable row level security;\nalter table public.english_shelf_curriculum_units enable row level security;\nalter table public.english_shelf_curriculum_unit_grammar_items enable row level security;\nalter table public.english_shelf_study_logs enable row level security;\nalter table public.english_shelf_migration_gates enable row level security;\nrevoke all on public.english_shelf_words, public.english_shelf_sentences, public.english_shelf_curriculum_units, public.english_shelf_curriculum_unit_grammar_items, public.english_shelf_study_logs, public.english_shelf_migration_gates from anon, authenticated;\ninsert into public.english_shelf_migration_gates(token_hash, used_at) values ('${tokenHash}', null) on conflict (token_hash) do update set used_at = null;\n\ncreate or replace function public.english_shelf_import_v1(p_token text, p_payload jsonb) returns jsonb\nlanguage plpgsql security definer set search_path = public, pg_temp as $$\ndeclare v_hash text; v_result jsonb;\nbegin\n  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');\n  if not exists (select 1 from public.english_shelf_migration_gates where token_hash = v_hash and used_at is null for update) then raise exception 'Invalid or already used migration token'; end if;\n  if exists(select 1 from public.english_shelf_words) or exists(select 1 from public.english_shelf_sentences) or exists(select 1 from public.english_shelf_curriculum_units) or exists(select 1 from public.english_shelf_study_logs) then raise exception 'English Shelf destination tables are not empty'; end if;\n  insert into public.english_shelf_words select * from jsonb_to_recordset(coalesce(p_payload->'words','[]'::jsonb)) as x(id bigint,vocabulary text,inflection text,meaning text,example text,last_reviewed_at text,forgetting_level integer,notion_page_id text,notion_url text,source_body text,created_at timestamptz,updated_at timestamptz);\n  insert into public.english_shelf_sentences select * from jsonb_to_recordset(coalesce(p_payload->'sentences','[]'::jsonb)) as x(id bigint,title text,meaning text,similar_sentences text,last_reviewed_at text,forgetting_level integer,notion_page_id text,notion_url text,source_body text,created_at timestamptz,updated_at timestamptz);\n  insert into public.english_shelf_curriculum_units select * from jsonb_to_recordset(coalesce(p_payload->'curriculum_units','[]'::jsonb)) as x(id bigint,title text,learning_objective text,sort_order integer,status text,mastery_percent integer,created_at timestamptz,updated_at timestamptz,basics_text text,rules jsonb,examples jsonb,practice jsonb,reference_links jsonb);\n  insert into public.english_shelf_curriculum_unit_grammar_items select * from jsonb_to_recordset(coalesce(p_payload->'curriculum_unit_grammar_items','[]'::jsonb)) as x(unit_id bigint,grammar_item_id bigint);\n  insert into public.english_shelf_study_logs select * from jsonb_to_recordset(coalesce(p_payload->'study_logs','[]'::jsonb)) as x(id bigint,recorded_at text,title text,summary text,mastery_note text,user_note text,curriculum_unit_id bigint,created_at timestamptz);\n  v_result := jsonb_build_object(\n    'words',(select coalesce(jsonb_agg(jsonb_build_array(id,vocabulary,inflection,meaning,example,last_reviewed_at,forgetting_level,notion_page_id,notion_url,source_body) order by id),'[]') from public.english_shelf_words),\n    'sentences',(select coalesce(jsonb_agg(jsonb_build_array(id,title,meaning,similar_sentences,last_reviewed_at,forgetting_level,notion_page_id,notion_url,source_body) order by id),'[]') from public.english_shelf_sentences),\n    'curriculum_units',(select coalesce(jsonb_agg(jsonb_build_array(id,title,learning_objective,sort_order,status,basics_text,rules,examples,practice,reference_links,mastery_percent) order by id),'[]') from public.english_shelf_curriculum_units),\n    'curriculum_unit_grammar_items',(select coalesce(jsonb_agg(jsonb_build_array(unit_id,grammar_item_id) order by unit_id,grammar_item_id),'[]') from public.english_shelf_curriculum_unit_grammar_items),\n    'study_logs',(select coalesce(jsonb_agg(jsonb_build_array(id,recorded_at,title,summary,mastery_note,user_note,curriculum_unit_id) order by id),'[]') from public.english_shelf_study_logs));\n  update public.english_shelf_migration_gates set used_at = now() where token_hash = v_hash;\n  return v_result;\nend $$;\nrevoke all on function public.english_shelf_import_v1(text,jsonb) from public;\ngrant execute on function public.english_shelf_import_v1(text,jsonb) to anon;\n`;
}

async function migrateToSupabase(settingsInput, token, payload, { fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
  const settings = validateSupabaseSettings(settingsInput, { allowEmpty: false });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${settings.url}/rest/v1/rpc/english_shelf_import_v1`, {
      method: 'POST', headers: { apikey: settings.publishableKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_token: token, p_payload: payload }), signal: controller.signal
    });
    if (!response.ok) { const detail = await response.text(); throw new Error(`Supabase移行に失敗しました（HTTP ${response.status}）${detail ? `: ${detail.slice(0, 240)}` : ''}`); }
    const serverView = await response.json();
    const localView = verificationView(payload);
    const localHash = fingerprint(localView), remoteHash = fingerprint(serverView);
    if (localHash !== remoteHash) throw new Error('コピー後の内容照合に失敗しました。ローカルSQLiteは変更されていません。');
    return { ok: true, counts: migrationSummary(payload), localHash, remoteHash };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Supabase移行がタイムアウトしました。ローカルSQLiteは変更されていません。');
    throw error;
  } finally { clearTimeout(timer); }
}

function createSafeSetupSql(token) {
  return createSetupSql(token)
    .replace(
      "insert into public.english_shelf_words select * from jsonb_to_recordset(coalesce(p_payload->'words','[]'::jsonb)) as x(id bigint,vocabulary text,inflection text,meaning text,example text,last_reviewed_at text,forgetting_level integer,notion_page_id text,notion_url text,source_body text,created_at timestamptz,updated_at timestamptz);",
      "insert into public.english_shelf_words(id,vocabulary,inflection,meaning,example,last_reviewed_at,forgetting_level,notion_page_id,notion_url,source_body,created_at,updated_at) select id,vocabulary,inflection,meaning,example,last_reviewed_at,nullif(forgetting_level,'')::integer,notion_page_id,notion_url,source_body,created_at,updated_at from jsonb_to_recordset(coalesce(p_payload->'words','[]'::jsonb)) as x(id bigint,vocabulary text,inflection text,meaning text,example text,last_reviewed_at text,forgetting_level text,notion_page_id text,notion_url text,source_body text,created_at timestamptz,updated_at timestamptz);"
    )
    .replace(
      "insert into public.english_shelf_sentences select * from jsonb_to_recordset(coalesce(p_payload->'sentences','[]'::jsonb)) as x(id bigint,title text,meaning text,similar_sentences text,last_reviewed_at text,forgetting_level integer,notion_page_id text,notion_url text,source_body text,created_at timestamptz,updated_at timestamptz);",
      "insert into public.english_shelf_sentences(id,title,meaning,similar_sentences,last_reviewed_at,forgetting_level,notion_page_id,notion_url,source_body,created_at,updated_at) select id,title,meaning,similar_sentences,last_reviewed_at,nullif(forgetting_level,'')::integer,notion_page_id,notion_url,source_body,created_at,updated_at from jsonb_to_recordset(coalesce(p_payload->'sentences','[]'::jsonb)) as x(id bigint,title text,meaning text,similar_sentences text,last_reviewed_at text,forgetting_level text,notion_page_id text,notion_url text,source_body text,created_at timestamptz,updated_at timestamptz);"
    )
    .replace(
      'insert into public.english_shelf_curriculum_units select *',
      'insert into public.english_shelf_curriculum_units(id,title,learning_objective,sort_order,status,mastery_percent,created_at,updated_at,basics_text,rules,examples,practice,reference_links) select *'
    )
    .replace(
      "insert into public.english_shelf_study_logs select * from jsonb_to_recordset(coalesce(p_payload->'study_logs','[]'::jsonb)) as x(id bigint,recorded_at text,title text,summary text,mastery_note text,user_note text,curriculum_unit_id bigint,created_at timestamptz);",
      "insert into public.english_shelf_study_logs(id,recorded_at,title,summary,mastery_note,user_note,curriculum_unit_id,created_at) select id,recorded_at,title,summary,mastery_note,user_note,nullif(curriculum_unit_id,'')::bigint,created_at from jsonb_to_recordset(coalesce(p_payload->'study_logs','[]'::jsonb)) as x(id bigint,recorded_at text,title text,summary text,mastery_note text,user_note text,curriculum_unit_id text,created_at timestamptz);"
    );
}

module.exports = { createMigrationPayload, verificationView, fingerprint, migrationSummary, createMigrationToken, createSetupSql: createSafeSetupSql, migrateToSupabase, nullableInteger };
