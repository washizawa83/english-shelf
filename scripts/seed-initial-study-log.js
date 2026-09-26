const path = require('node:path');
const { StudyDatabase } = require('../src/database');

const database = new StudyDatabase(path.join(__dirname, '..', 'data', 'english-study.db'));
try {
  const unit = database.listCurriculumUnits().find(item => item.title === '形容詞・副詞');
  if (!unit) throw new Error('関連単元「形容詞・副詞」が見つかりません');
  const records = [
    {
      title: 'at と in の使い分け',
      summary: 'at は地点・施設での活動、in は空間・範囲の中、例: study at the library / walk in the park。'
    },
    {
      title: '場所と時の語順',
      summary: '文の骨格の後に場所、次に時を置く基本、例: I study at the library every day。'
    }
  ];
  const logs = records.map(record => {
    const existing = database.listStudyLogs().find(log => log.title === record.title && log.summary === record.summary);
    const log = existing || database.createStudyLog({ ...record, curriculum_unit_id: unit.id });
    return { created: !existing, id: log.id, title: log.title, recorded_at: log.recorded_at, curriculum_unit_title: log.curriculum_unit_title };
  });
  console.log(JSON.stringify(logs));
} finally {
  database.close();
}
