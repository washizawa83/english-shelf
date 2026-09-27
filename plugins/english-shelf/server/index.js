const path = require('node:path');
const fs = require('node:fs');
const { createSelectedDataStore } = require('../../../src/data-store/factory');
const { StudyService } = require('../../../src/study-service');

const text = { type: 'string' }, number = { type: 'number' };
const tools = [
  { name: 'save_word', description: 'Save an English word.', inputSchema: { type: 'object', properties: { vocabulary: text, inflection: text, meaning: text, example: text, last_reviewed_at: text, forgetting_level: number }, required: ['vocabulary'] } },
  { name: 'search_words', description: 'Search all saved word fields.', inputSchema: { type: 'object', properties: { query: text }, required: ['query'] } },
  { name: 'get_word', description: 'Get one word by internal ID.', inputSchema: { type: 'object', properties: { id: number }, required: ['id'] } },
  { name: 'update_word', description: 'Update fields on a saved word.', inputSchema: { type: 'object', properties: { id: number, vocabulary: text, inflection: text, meaning: text, example: text, last_reviewed_at: text, forgetting_level: number }, required: ['id'] } },
  { name: 'save_sentence', description: 'Save an English sentence or grammar note.', inputSchema: { type: 'object', properties: { title: text, meaning: text, similar_sentences: text, last_reviewed_at: text, forgetting_level: number }, required: ['title'] } },
  { name: 'search_sentences', description: 'Search all saved sentence and grammar fields.', inputSchema: { type: 'object', properties: { query: text }, required: ['query'] } },
  { name: 'get_sentence', description: 'Get one sentence by internal ID.', inputSchema: { type: 'object', properties: { id: number }, required: ['id'] } },
  { name: 'update_sentence', description: 'Update fields on a saved sentence or grammar note.', inputSchema: { type: 'object', properties: { id: number, title: text, meaning: text, similar_sentences: text, last_reviewed_at: text, forgetting_level: number }, required: ['id'] } },
  { name: 'list_due_reviews', description: 'List word and sentence records whose review is due.', inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['words', 'sentences', 'all'] } } } },
  { name: 'record_review_result', description: 'Record without_hint, with_hint, or unknown and update review time and level.', inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['words', 'sentences'] }, id: number, result: { type: 'string', enum: ['without_hint', 'with_hint', 'unknown'] } }, required: ['kind', 'id', 'result'] } },
  { name: 'get_curriculum_context', description: 'Read all curriculum units and all independent grammar items so Codex can propose a learning sequence.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_curriculum_unit', description: 'Get one curriculum unit with its related grammar items.', inputSchema: { type: 'object', properties: { id: number }, required: ['id'] } },
  { name: 'create_curriculum_unit', description: 'Create a curriculum unit after the user approves a proposed plan.', inputSchema: { type: 'object', properties: { title: text, learning_objective: text, sort_order: number, status: { type: 'string', enum: ['未着手', '学習中', '完了'] } }, required: ['title'] } },
  { name: 'update_curriculum_unit', description: 'Update a curriculum unit title, objective, order, or progress.', inputSchema: { type: 'object', properties: { id: number, title: text, learning_objective: text, sort_order: number, status: { type: 'string', enum: ['未着手', '学習中', '完了'] } }, required: ['id'] } },
  { name: 'get_curriculum_mastery', description: 'Read the AI-managed mastery percentage for one curriculum unit.', inputSchema: { type: 'object', properties: { id: number }, required: ['id'] } },
  { name: 'update_curriculum_mastery', description: 'Update AI-managed mastery. Prefer correct_answers after the 10-question finish quiz; mastery is saved as correct_answers × 10. A direct 0-100 integer may also be supplied.', inputSchema: { type: 'object', properties: { id: number, correct_answers: { type: 'number', minimum: 0, maximum: 10 }, mastery_percent: { type: 'number', minimum: 0, maximum: 100 } }, required: ['id'] } },
  { name: 'create_study_log', description: 'Create one timestamped learning log at a meaningful learning milestone. For every completed finishing-quiz attempt, create a new record, summarize the score, question coverage, and every incorrect answer, and always pass its curriculum_unit_id; repeated attempts for the same unit must remain separate records. Skip routine turns, duplicate non-quiz learning in the same conversation, and anything the learner asks not to record. Link other records to a clear curriculum unit, or leave them unlinked when unclear. Never populate or overwrite user_note; it is reserved for the learner. The timestamp is added automatically.', inputSchema: { type: 'object', properties: { title: text, summary: text, mastery_note: text, curriculum_unit_id: number }, required: ['title', 'summary'] } },
  { name: 'list_study_logs', description: 'List learning logs in reverse chronological order, including each learner-authored user_note.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_study_log', description: 'Get one learning log, its learner-authored user_note, and its optional related curriculum unit.', inputSchema: { type: 'object', properties: { id: number }, required: ['id'] } },
  { name: 'update_study_log_note', description: 'Update only the learner-authored note on an existing learning log. Use only when the learner explicitly asks to change their memo; never call this during automatic learning-log creation.', inputSchema: { type: 'object', properties: { id: number, user_note: text }, required: ['id', 'user_note'] } },
  { name: 'reorder_curriculum_units', description: 'Set curriculum order using every current unit ID exactly once.', inputSchema: { type: 'object', properties: { unit_ids: { type: 'array', items: number } }, required: ['unit_ids'] } },
  { name: 'link_grammar_to_unit', description: 'Relate an existing independent grammar item to a curriculum unit.', inputSchema: { type: 'object', properties: { unit_id: number, grammar_item_id: number }, required: ['unit_id', 'grammar_item_id'] } },
  { name: 'unlink_grammar_from_unit', description: 'Remove a curriculum relation without deleting the grammar item.', inputSchema: { type: 'object', properties: { unit_id: number, grammar_item_id: number }, required: ['unit_id', 'grammar_item_id'] } }
];

const sqlitePath = path.resolve(__dirname, '../../../data/english-study.db');
const runtimePath = path.resolve(__dirname, '../../../data/supabase-runtime.json');
let cachedService, cachedRuntime = '';
async function getService() {
  const signature = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath, 'utf8') : 'sqlite';
  if (!cachedService || signature !== cachedRuntime) {
    cachedService?.close();
    cachedService = new StudyService(await createSelectedDataStore({ defaultSqlitePath: sqlitePath }));
    cachedRuntime = signature;
  }
  return cachedService;
}

async function callTool(name, input) {
  const service = await getService();
  if (name === 'save_word') return service.save('words', { ...input, forgetting_level: input.forgetting_level ?? 1 });
  if (name === 'search_words') return service.list('words', input.query);
  if (name === 'get_word') return service.get('words', input.id);
  if (name === 'update_word') return service.updateEntry('words', input);
  if (name === 'save_sentence') return service.save('sentences', { ...input, forgetting_level: input.forgetting_level ?? 1 });
  if (name === 'search_sentences') return service.list('sentences', input.query);
  if (name === 'get_sentence') return service.get('sentences', input.id);
  if (name === 'update_sentence') return service.updateEntry('sentences', input);
  if (name === 'list_due_reviews') return { words: input.kind === 'sentences' ? [] : await service.due('words'), sentences: input.kind === 'words' ? [] : await service.due('sentences') };
  if (name === 'record_review_result') return service.recordReview(input.kind, input.id, input.result);
  if (name === 'get_curriculum_context') return { units: await service.listCurriculumUnits(), grammar_items: await service.list('sentences') };
  if (name === 'get_curriculum_unit') return service.getCurriculumUnit(input.id);
  if (name === 'create_curriculum_unit') return service.saveCurriculumUnit(input);
  if (name === 'update_curriculum_unit') return service.updateCurriculumUnit(input);
  if (name === 'get_curriculum_mastery') return service.getCurriculumMastery(input.id);
  if (name === 'update_curriculum_mastery') return service.updateCurriculumMastery(input.id, input);
  if (name === 'create_study_log') return service.createStudyLog(input);
  if (name === 'list_study_logs') return service.listStudyLogs();
  if (name === 'get_study_log') return service.getStudyLog(input.id);
  if (name === 'update_study_log_note') return service.updateStudyLogNote(input.id, input.user_note);
  if (name === 'reorder_curriculum_units') return service.reorderCurriculumUnits(input.unit_ids || []);
  if (name === 'link_grammar_to_unit') return service.linkGrammarItem(input.unit_id, input.grammar_item_id);
  if (name === 'unlink_grammar_from_unit') return service.unlinkGrammarItem(input.unit_id, input.grammar_item_id);
  throw new Error(`Unknown tool: ${name}`);
}

function respond(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
async function handle(message) {
  if (!message.id) return;
  if (message.method === 'initialize') return respond({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: message.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'english-shelf', version: '1.0.0' } } });
  if (message.method === 'tools/list') return respond({ jsonrpc: '2.0', id: message.id, result: { tools } });
  if (message.method === 'tools/call') {
    try { const value = await callTool(message.params.name, message.params.arguments || {}); return respond({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value } }); }
    catch (error) { return respond({ jsonrpc: '2.0', id: message.id, result: { isError: true, content: [{ type: 'text', text: error.message }] } }); }
  }
  respond({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } });
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
    if (line) handle(JSON.parse(line)).catch(error => process.stderr.write(`${error.stack}\n`));
  }
});
