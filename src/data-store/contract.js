const DATA_STORE_METHODS = [
  'list', 'get', 'save', 'importNotion', 'due', 'review',
  'listCurriculumUnits', 'getCurriculumUnit', 'saveCurriculumUnit',
  'saveCurriculumDetails', 'updateCurriculumMastery', 'moveCurriculumUnit',
  'reorderCurriculumUnits', 'linkGrammarItem', 'unlinkGrammarItem',
  'listStudyLogs', 'getStudyLog', 'createStudyLog', 'updateStudyLogNote',
  'counts', 'close'
];

function assertDataStore(store) {
  if (!store || typeof store !== 'object') throw new TypeError('DataStore must be an object');
  const missing = DATA_STORE_METHODS.filter(method => typeof store[method] !== 'function');
  if (missing.length) throw new TypeError(`DataStore is missing: ${missing.join(', ')}`);
  return store;
}

module.exports = { DATA_STORE_METHODS, assertDataStore };
