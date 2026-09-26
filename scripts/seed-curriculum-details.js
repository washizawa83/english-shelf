const path = require('node:path');
const { StudyDatabase } = require('../src/database');
const details = require('../src/curriculum-details');

const database = new StudyDatabase(path.join(__dirname, '..', 'data', 'english-study.db'));
try {
  const units = database.listCurriculumUnits();
  const byTitle = new Map(units.map(unit => [unit.title, unit]));
  const missing = details.filter(detail => !byTitle.has(detail.title)).map(detail => detail.title);
  if (missing.length) throw new Error(`対象単元が見つかりません: ${missing.join(', ')}`);

  const before = database.db.prepare('SELECT COUNT(*) count FROM curriculum_unit_grammar_items').get().count;
  const save = database.db.transaction(() => {
    for (const detail of details) database.saveCurriculumDetails(byTitle.get(detail.title).id, detail);
  });
  save();
  const after = database.db.prepare('SELECT COUNT(*) count FROM curriculum_unit_grammar_items').get().count;
  if (before !== after) throw new Error('関連付け件数が変化しました');
  console.log(JSON.stringify({ updated: details.length, relationsBefore: before, relationsAfter: after }));
} finally {
  database.close();
}
