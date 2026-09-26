const Database = require('better-sqlite3');

const mistakenTitles = ['呼びかけと返答', '会話中の時間調整', '丁寧な依頼と即答', '気遣いと状況説明'];
const units = [
  ['英文の語順と主語・動詞', '「誰が／何が」+「どうする／どんな状態」'],
  ['be動詞', 'am / are / is と否定文・疑問文'],
  ['一般動詞', 'like / play / know と do / does'],
  ['三人称単数', 'he / she / it の動詞のs'],
  ['名詞・代名詞・複数形', 'I / you / he、数えられる名詞など'],
  ['冠詞', 'a / an / the'],
  ['形容詞・副詞', '名詞や動詞を説明する語'],
  ['疑問文・疑問詞', 'what / when / where / who / why / how'],
  ['前置詞・接続詞', 'in / on / at、and / but / because など'],
  ['命令・提案・基本助動詞', "命令文、Let's、can / will / must / should"],
  ['過去形', 'した・だった'],
  ['現在進行形・過去進行形', 'している・していた'],
  ['未来表現', 'will / be going to と予定の言い方'],
  ['不定詞', 'to + 動詞。「〜すること」「〜するため」など'],
  ['動名詞', '動詞 + ing を名詞として使う形'],
  ['比較', '比較級・最上級、as ... as'],
  ['受け身の入口', 'be + 過去分詞で「〜される」'],
  ['5文型', 'S・V・O・Cの役割で文の骨組みを見る'],
  ['現在完了', '経験・継続・完了／結果'],
  ['関係代名詞', '名詞を後ろから詳しく説明する who / which / that'],
  ['助動詞の使い分け', '可能、依頼、推量、義務、助言'],
  ['受動態', '受け身を単独テーマとして扱う'],
  ['分詞', '現在分詞・過去分詞で名詞を説明する'],
  ['完了形の発展', '現在完了の使い分けをより細かくする'],
  ['関係代名詞の発展', '省略や、より複雑な修飾を読む'],
  ['仮定法', '「もし〜なら」「〜だったのに」'],
  ['分詞構文', '文を短くつなぐ発展表現'],
  ['話法', '発言を引用・間接的に伝える表現']
];

const db = new Database('data/english-study.db');
db.pragma('foreign_keys = ON');
const seed = db.transaction(() => {
  const mistaken = db.prepare(`SELECT id, title FROM curriculum_units WHERE title IN (${mistakenTitles.map(() => '?').join(',')})`).all(...mistakenTitles);
  const relationCount = db.prepare(`SELECT COUNT(*) count FROM curriculum_unit_grammar_items WHERE unit_id IN (${mistakenTitles.map(() => '?').join(',')})`).get(...mistaken.map(unit => unit.id), ...Array(mistakenTitles.length - mistaken.length).fill(-1)).count;
  if (relationCount !== 0) throw new Error('誤登録単元に関連付けがあるため、安全のため処理を中止しました');
  const remove = db.prepare('DELETE FROM curriculum_units WHERE id = ?');
  mistaken.forEach(unit => remove.run(unit.id));

  const find = db.prepare('SELECT id FROM curriculum_units WHERE title = ?');
  const insert = db.prepare("INSERT INTO curriculum_units (title, learning_objective, sort_order, status) VALUES (?, ?, ?, '未着手')");
  let nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 value FROM curriculum_units').get().value;
  let created = 0;
  let skipped = 0;
  for (const [title, objective] of units) {
    if (find.get(title)) { skipped += 1; continue; }
    insert.run(title, objective, nextOrder++);
    created += 1;
  }
  return { removedMistakenUnits: mistaken.length, created, skipped };
});

console.log(seed());
db.close();
