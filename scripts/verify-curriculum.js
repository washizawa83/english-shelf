const Database = require('better-sqlite3');
const db = new Database('data/english-study.db', { readonly: true });
console.log({
  units: db.prepare('SELECT COUNT(*) count FROM curriculum_units').get().count,
  relations: db.prepare('SELECT COUNT(*) count FROM curriculum_unit_grammar_items').get().count,
  grammarItems: db.prepare('SELECT COUNT(*) count FROM sentences').get().count,
  words: db.prepare('SELECT COUNT(*) count FROM words').get().count,
  detailedUnits: db.prepare("SELECT COUNT(*) count FROM curriculum_units WHERE basics_text <> '' AND rules_json <> '[]' AND examples_json <> '[]' AND practice_json <> '[]' AND reference_links_json <> '[]'").get().count,
  unitsWithFiveExamples: db.prepare("SELECT COUNT(*) count FROM curriculum_units WHERE json_array_length(examples_json) = 5").get().count,
  unitsWithFivePracticeQuestions: db.prepare("SELECT COUNT(*) count FROM curriculum_units WHERE json_array_length(practice_json) = 5").get().count,
  unitsWithFivePracticeHints: db.prepare("SELECT COUNT(*) count FROM curriculum_units u WHERE json_array_length(u.practice_json) = 5 AND (SELECT COUNT(*) FROM json_each(u.practice_json) WHERE COALESCE(json_extract(value, '$.hint'), '') <> '') = 5").get().count,
  zeroMasteryUnits: db.prepare('SELECT COUNT(*) count FROM curriculum_units WHERE mastery_percent = 0').get().count,
  invalidMasteryUnits: db.prepare('SELECT COUNT(*) count FROM curriculum_units WHERE mastery_percent < 0 OR mastery_percent > 100 OR mastery_percent != CAST(mastery_percent AS INTEGER)').get().count,
  mistakenUnits: db.prepare("SELECT COUNT(*) count FROM curriculum_units WHERE title IN ('呼びかけと返答','会話中の時間調整','丁寧な依頼と即答','気遣いと状況説明')").get().count
});
console.log(db.prepare('SELECT sort_order, title, learning_objective, status FROM curriculum_units ORDER BY sort_order, id').all());
db.close();
