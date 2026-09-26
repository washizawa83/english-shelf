const { assertDataStore } = require('./data-store/contract');
const { intervals } = require('./study-domain');

class StudyService {
  constructor(store) { this.store = assertDataStore(store); }
  list(...args) { return this.store.list(...args); }
  get(...args) { return this.store.get(...args); }
  save(...args) { return this.store.save(...args); }
  importNotion(...args) { return this.store.importNotion(...args); }
  async due(kind, now = new Date()) {
    return (await this.list(kind)).filter(entry => {
      if (!entry.last_reviewed_at) return true;
      const reviewedAt = new Date(entry.last_reviewed_at).getTime();
      if (!Number.isFinite(reviewedAt)) return true;
      const raw = Number(entry.forgetting_level);
      const level = Number.isInteger(raw) && raw >= 1 && raw <= 8 ? raw : 1;
      return reviewedAt + intervals[level] <= now.getTime();
    });
  }
  async review(kind, id, result, now = new Date()) {
    const entry = await this.get(kind, id);
    if (!entry) throw new Error('Entry not found');
    const raw = Number(entry.forgetting_level);
    let level = Number.isInteger(raw) && raw >= 1 && raw <= 8 ? raw : 1;
    if (result === 'easy') level = Math.min(8, level + 1);
    if (result === 'hard') level = Math.max(1, level - 1);
    return this.save(kind, { ...entry, forgetting_level: level, last_reviewed_at: now.toISOString() });
  }
  listCurriculumUnits(...args) { return this.store.listCurriculumUnits(...args); }
  getCurriculumUnit(...args) { return this.store.getCurriculumUnit(...args); }
  saveCurriculumUnit(...args) { return this.store.saveCurriculumUnit(...args); }
  saveCurriculumDetails(...args) { return this.store.saveCurriculumDetails(...args); }
  updateCurriculumMastery(...args) { return this.store.updateCurriculumMastery(...args); }
  moveCurriculumUnit(...args) { return this.store.moveCurriculumUnit(...args); }
  reorderCurriculumUnits(...args) { return this.store.reorderCurriculumUnits(...args); }
  linkGrammarItem(...args) { return this.store.linkGrammarItem(...args); }
  unlinkGrammarItem(...args) { return this.store.unlinkGrammarItem(...args); }
  listStudyLogs(...args) { return this.store.listStudyLogs(...args); }
  getStudyLog(...args) { return this.store.getStudyLog(...args); }
  createStudyLog(...args) { return this.store.createStudyLog(...args); }
  updateStudyLogNote(...args) { return this.store.updateStudyLogNote(...args); }
  counts(...args) { return this.store.counts(...args); }
  close() { return this.store.close(); }
  async updateEntry(kind, input) { const existing = await this.get(kind, input.id); if (!existing) throw new Error('Entry not found'); return this.save(kind, { ...existing, ...input }); }
  async updateCurriculumUnit(input) { const existing = await this.getCurriculumUnit(input.id); if (!existing) throw new Error('Curriculum unit not found'); return this.saveCurriculumUnit({ ...existing, ...input }); }
  async recordReview(kind, id, result) { const mapping = { without_hint: 'easy', with_hint: 'normal', unknown: 'hard' }; return this.review(kind, id, mapping[result] || result); }
  async getCurriculumMastery(id) { const unit = await this.getCurriculumUnit(id); if (!unit) throw new Error('Curriculum unit not found'); return { id: unit.id, title: unit.title, mastery_percent: Number(unit.mastery_percent) || 0 }; }
}

module.exports = { StudyService };
