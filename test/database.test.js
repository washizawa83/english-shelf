const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { StudyDatabase } = require('../src/database');
const source = require('../src/imported-notion-data');
const bodies = require('../src/notion-page-bodies');

test('Notion migration is complete and idempotent', () => {
  const db = new StudyDatabase(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-')), 'study.db'));
  db.importNotion('words', source.words, bodies);
  db.importNotion('sentences', source.sentences, bodies);
  assert.deepEqual(db.counts(), { words: 30, sentences: 8 });
  db.importNotion('words', source.words, bodies);
  db.importNotion('sentences', source.sentences, bodies);
  assert.deepEqual(db.counts(), { words: 30, sentences: 8 });
  const about = db.list('words', 'about')[0];
  assert.match(about.notion_page_id, /^[a-f0-9-]{36}$/);
  assert.equal(about.forgetting_level, 1);
  assert.equal(about.last_reviewed_at, '2026-09-25T16:47:00.000Z');
  assert.ok(typeof about.source_body === 'string');
  assert.equal(db.list('sentences', 'Could you')[0].similar_sentences.includes('Could you help me?'), true);
  db.close();
});

test('search, editing, and spaced review work for both entity types', () => {
  const db = new StudyDatabase(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-')), 'study.db'));
  const word = db.save('words', { vocabulary: 'resilient', inflection: 'resilience', meaning: '回復力のある', example: 'She is resilient.', forgetting_level: 1 });
  const sentence = db.save('sentences', { title: 'Keep moving forward.', meaning: '前に進み続けよう。', similar_sentences: 'Never give up.', forgetting_level: 4 });
  assert.equal(db.list('words', 'resil').length, 1);
  assert.equal(db.list('sentences', '前に').length, 1);
  assert.equal(db.due('words').length, 1);
  assert.equal(db.review('words', word.id, 'easy', new Date('2026-01-01T00:00:00Z')).forgetting_level, 2);
  assert.equal(db.due('words', new Date('2026-01-01T00:30:00Z')).length, 0);
  assert.equal(db.due('words', new Date('2026-01-01T01:01:00Z')).length, 1);
  assert.equal(db.review('sentences', sentence.id, 'hard').forgetting_level, 3);
  const invalid = db.save('words', { vocabulary: 'raw', forgetting_level: 'unknown', last_reviewed_at: 'not-a-date' });
  assert.equal(db.get('words', invalid.id).forgetting_level, 'unknown');
  assert.equal(db.due('words').some(row => row.id === invalid.id), true);
  db.close();
});

test('word search ranks prefix matches before cross-field partial matches without duplicates', () => {
  const db = new StudyDatabase(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-')), 'study.db'));
  const prefix = db.save('words', { vocabulary: 'apple', meaning: 'りんご' });
  db.save('words', { vocabulary: 'pineapple', meaning: 'パイナップル' });
  db.save('words', { vocabulary: 'fruit', meaning: 'apple-like food' });
  const matches = db.list('words', 'app');
  assert.equal(matches[0].id, prefix.id);
  assert.equal(matches.length, 3);
  assert.equal(new Set(matches.map(entry => entry.id)).size, matches.length);
  assert.equal(db.list('words', '').length, 3);
  db.close();
});

test('existing AI mastery notes remain separate while user notes start empty', () => {
  const filename = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-legacy-')), 'study.db');
  const legacy = new Database(filename);
  legacy.exec(`
    CREATE TABLE study_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      mastery_note TEXT NOT NULL DEFAULT '',
      curriculum_unit_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO study_logs (recorded_at, title, summary, mastery_note)
    VALUES ('2026-09-26T03:00:00.000Z', '既存記録', '既存本文', 'AIの理解度メモ');
  `);
  legacy.close();

  const db = new StudyDatabase(filename);
  const migrated = db.getStudyLog(1);
  assert.equal(migrated.mastery_note, 'AIの理解度メモ');
  assert.equal(migrated.user_note, '');
  db.close();
});

test('curriculum units are ordered and relate grammar items many-to-many', () => {
  const db = new StudyDatabase(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-')), 'study.db'));
  const grammar = db.save('sentences', { title: 'Could you help me?', meaning: '手伝っていただけますか？' });
  const first = db.saveCurriculumUnit({ title: '依頼表現', learning_objective: '丁寧に依頼できる', status: '未着手' });
  const second = db.saveCurriculumUnit({ title: '実践', learning_objective: '会話で使う', status: '学習中' });
  db.saveCurriculumDetails(first.id, { basics: '依頼の基本', rules: ['Could you + 原形'], examples: [{ english: 'Could you help me?', japanese: '手伝っていただけますか。' }], practice: [{ question: 'Could you ___ me?', hint: 'help を使う', answer: 'help' }], references: [{ label: 'reference', url: 'https://example.com' }] });
  db.linkGrammarItem(first.id, grammar.id);
  db.linkGrammarItem(second.id, grammar.id);
  assert.equal(db.getCurriculumUnit(first.id).grammar_items[0].id, grammar.id);
  assert.equal(db.getCurriculumUnit(second.id).grammar_items[0].id, grammar.id);
  assert.equal(db.getCurriculumUnit(first.id).details.basics, '依頼の基本');
  assert.deepEqual(db.getCurriculumUnit(first.id).details.rules, ['Could you + 原形']);
  assert.equal(db.getCurriculumUnit(first.id).details.examples[0].english, 'Could you help me?');
  assert.equal(db.getCurriculumUnit(first.id).details.practice[0].hint, 'help を使う');
  assert.equal(db.getCurriculumUnit(first.id).mastery_percent, 0);
  assert.equal(db.updateCurriculumMastery(first.id, { correct_answers: 7 }).mastery_percent, 70);
  assert.equal(db.updateCurriculumMastery(first.id, { mastery_percent: 85 }).mastery_percent, 85);
  assert.throws(() => db.updateCurriculumMastery(first.id, { correct_answers: 11 }), /0〜10/);
  const log = db.createStudyLog({ title: '依頼表現の復習', summary: '丁寧な依頼を確認した。', mastery_note: '基本を理解', curriculum_unit_id: first.id }, new Date('2026-09-26T03:00:00.000Z'));
  assert.equal(log.recorded_at, '2026-09-26T03:00:00.000Z');
  assert.equal(log.curriculum_unit_title, '依頼表現');
  assert.equal(log.mastery_note, '基本を理解');
  assert.equal(log.user_note, '');
  const noted = db.updateStudyLogNote(log.id, 'あとで例文を追加する');
  assert.equal(noted.user_note, 'あとで例文を追加する');
  assert.equal(noted.mastery_note, '基本を理解');
  assert.equal(db.listStudyLogs()[0].id, log.id);
  assert.equal(db.getCurriculumUnit(first.id).study_logs[0].id, log.id);
  db.moveCurriculumUnit(second.id, 'up');
  assert.equal(db.listCurriculumUnits()[0].id, second.id);
  assert.equal(db.saveCurriculumUnit({ ...first, status: '完了' }).status, '完了');
  db.unlinkGrammarItem(first.id, grammar.id);
  assert.equal(db.getCurriculumUnit(first.id).grammar_items.length, 0);
  assert.equal(db.get('sentences', grammar.id).title, 'Could you help me?');
  db.close();
});
