const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

test('MCP server exposes CRUD and review tools against the shared schema', async () => {
  const tempDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-mcp-')), 'study.db');
  fs.copyFileSync(path.join(__dirname, '..', 'data', 'english-study.db'), tempDb);
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'plugins', 'english-shelf', 'server', 'index.js')], {
    env: { ...process.env, ENGLISH_SHELF_DB: tempDb },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let id = 0;
  let buffer = '';
  const pending = new Map();
  server.stdout.setEncoding('utf8');
  server.stdout.on('data', chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) { const message = JSON.parse(line); pending.get(message.id)?.(message); pending.delete(message.id); }
    }
  });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => reject(new Error(`MCP timeout: ${method}`)), 5000);
    pending.set(requestId, message => { clearTimeout(timer); resolve(message); });
    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })}\n`);
  });
  try {
    const initialized = await request('initialize', { protocolVersion: '2025-06-18' });
    assert.equal(initialized.result.serverInfo.name, 'english-shelf');
    const listed = await request('tools/list');
    assert.equal(listed.result.tools.length, 23);
    assert.ok(listed.result.tools.some(tool => tool.name === 'record_review_result'));
    const createStudyLogTool = listed.result.tools.find(tool => tool.name === 'create_study_log');
    assert.match(createStudyLogTool.description, /meaningful learning milestone/);
    assert.match(createStudyLogTool.description, /asks not to record/);
    const searched = await request('tools/call', { name: 'search_words', arguments: { query: 'about' } });
    assert.equal(searched.result.structuredContent[0].vocabulary, 'about');
    const saved = await request('tools/call', { name: 'save_word', arguments: { vocabulary: 'testable', meaning: 'testできる', forgetting_level: 1 } });
    const savedEntry = saved.result.structuredContent;
    await request('tools/call', { name: 'save_word', arguments: { vocabulary: 'attestable', meaning: 'testを含む' } });
    const ranked = await request('tools/call', { name: 'search_words', arguments: { query: 'test' } });
    assert.equal(ranked.result.structuredContent[0].vocabulary, 'testable');
    assert.equal(new Set(ranked.result.structuredContent.map(entry => entry.id)).size, ranked.result.structuredContent.length);
    const updated = await request('tools/call', { name: 'update_word', arguments: { id: savedEntry.id, example: 'This is testable.' } });
    assert.equal(updated.result.structuredContent.example, 'This is testable.');
    const reviewed = await request('tools/call', { name: 'record_review_result', arguments: { kind: 'words', id: savedEntry.id, result: 'without_hint' } });
    assert.equal(reviewed.result.structuredContent.forgetting_level, 2);
    assert.ok(reviewed.result.structuredContent.last_reviewed_at);
    const due = await request('tools/call', { name: 'list_due_reviews', arguments: { kind: 'all' } });
    assert.ok(Array.isArray(due.result.structuredContent.words));
    assert.ok(Array.isArray(due.result.structuredContent.sentences));
    const context = await request('tools/call', { name: 'get_curriculum_context', arguments: {} });
    const grammarId = context.result.structuredContent.grammar_items[0].id;
    const unit = await request('tools/call', { name: 'create_curriculum_unit', arguments: { title: 'MCP単元', learning_objective: 'AI提案を保存する' } });
    const linked = await request('tools/call', { name: 'link_grammar_to_unit', arguments: { unit_id: unit.result.structuredContent.id, grammar_item_id: grammarId } });
    assert.equal(linked.result.structuredContent.grammar_items[0].id, grammarId);
    const progressed = await request('tools/call', { name: 'update_curriculum_unit', arguments: { id: unit.result.structuredContent.id, status: '学習中' } });
    assert.equal(progressed.result.structuredContent.status, '学習中');
    const mastery = await request('tools/call', { name: 'update_curriculum_mastery', arguments: { id: unit.result.structuredContent.id, correct_answers: 8 } });
    assert.equal(mastery.result.structuredContent.mastery_percent, 80);
    const readMastery = await request('tools/call', { name: 'get_curriculum_mastery', arguments: { id: unit.result.structuredContent.id } });
    assert.equal(readMastery.result.structuredContent.mastery_percent, 80);
    const studyLog = await request('tools/call', { name: 'create_study_log', arguments: { title: 'MCP学習記録', summary: '要点を確認した。', mastery_note: '理解できた', curriculum_unit_id: unit.result.structuredContent.id } });
    assert.equal(studyLog.result.structuredContent.curriculum_unit_title, 'MCP単元');
    assert.ok(studyLog.result.structuredContent.recorded_at);
    assert.equal(studyLog.result.structuredContent.user_note, '');
    const updatedNote = await request('tools/call', { name: 'update_study_log_note', arguments: { id: studyLog.result.structuredContent.id, user_note: '自分で追記したメモ' } });
    assert.equal(updatedNote.result.structuredContent.user_note, '自分で追記したメモ');
    assert.equal(updatedNote.result.structuredContent.mastery_note, '理解できた');
    const listedLogs = await request('tools/call', { name: 'list_study_logs', arguments: {} });
    assert.equal(listedLogs.result.structuredContent[0].id, studyLog.result.structuredContent.id);
    const fetchedLog = await request('tools/call', { name: 'get_study_log', arguments: { id: studyLog.result.structuredContent.id } });
    assert.equal(fetchedLog.result.structuredContent.summary, '要点を確認した。');
    assert.equal(fetchedLog.result.structuredContent.user_note, '自分で追記したメモ');
    const unlinked = await request('tools/call', { name: 'unlink_grammar_from_unit', arguments: { unit_id: unit.result.structuredContent.id, grammar_item_id: grammarId } });
    assert.equal(unlinked.result.structuredContent.grammar_items.length, 0);
  } finally {
    server.kill();
  }
});

test('English Shelf skill limits automatic learning records to meaningful milestones', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'english-shelf', 'skills', 'english-shelf-curriculum', 'SKILL.md'), 'utf8');
  assert.match(skill, /question is resolved and their understanding is confirmed/);
  assert.match(skill, /curriculum practice questions or a finishing quiz is completed/);
  assert.match(skill, /Questions 1-3 are four-option multiple-choice questions/);
  assert.match(skill, /Questions 4-7 are English sentence transformation questions/);
  assert.match(skill, /Questions 8-10 ask the learner to translate a Japanese sentence into English/);
  assert.match(skill, /Do not reuse the same source sentence, target answer, or transformation pattern/);
  assert.match(skill, /update_curriculum_mastery.*correct_answers/);
  assert.match(skill, /create exactly one learning record for the completed quiz/);
  assert.match(skill, /what each question asked, its question type, and the learning point tested/);
  assert.match(skill, /each missed question number, the learner's answer, the correct answer/);
  assert.match(skill, /Always set `curriculum_unit_id` to the unit used for the quiz/);
  assert.match(skill, /must never be left unlinked/);
  assert.match(skill, /Do not populate `user_note`/);
  assert.doesNotMatch(skill, /mini practice|英文・文法/);
  assert.match(skill, /natural stopping point/);
  assert.match(skill, /Do not create a second record for the same learning in the same conversation/);
  assert.match(skill, /記録しないで/);
  assert.match(skill, /omit it rather than guessing/);
  assert.match(skill, /Never populate or overwrite it during automatic recording/);
  assert.match(skill, /update_study_log_note/);
});
