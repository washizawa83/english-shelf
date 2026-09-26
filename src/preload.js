const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studyApi', {
  list: (kind, query) => ipcRenderer.invoke('entries:list', kind, query),
  get: (kind, id) => ipcRenderer.invoke('entries:get', kind, id),
  save: (kind, payload) => ipcRenderer.invoke('entries:save', kind, payload),
  due: kind => ipcRenderer.invoke('entries:due', kind),
  review: (kind, id, result) => ipcRenderer.invoke('entries:review', kind, id, result),
  listCurriculum: () => ipcRenderer.invoke('curriculum:list'),
  saveCurriculum: payload => ipcRenderer.invoke('curriculum:save', payload),
  moveCurriculum: (id, direction) => ipcRenderer.invoke('curriculum:move', id, direction),
  linkCurriculumGrammar: (unitId, grammarItemId) => ipcRenderer.invoke('curriculum:link', unitId, grammarItemId),
  unlinkCurriculumGrammar: (unitId, grammarItemId) => ipcRenderer.invoke('curriculum:unlink', unitId, grammarItemId),
  listStudyLogs: () => ipcRenderer.invoke('study-logs:list'),
  getStudyLog: id => ipcRenderer.invoke('study-logs:get', id),
  updateStudyLogNote: (id, userNote) => ipcRenderer.invoke('study-logs:update-note', id, userNote),
  getSupabaseSettings: () => ipcRenderer.invoke('settings:supabase:get'),
  saveSupabaseSettings: settings => ipcRenderer.invoke('settings:supabase:save', settings),
  checkSupabaseConnection: settings => ipcRenderer.invoke('settings:supabase:check', settings),
  prepareSupabaseMigration: () => ipcRenderer.invoke('migration:supabase:prepare'),
  runSupabaseMigration: () => ipcRenderer.invoke('migration:supabase:run'),
  getDataStoreStatus: () => ipcRenderer.invoke('data-store:status'),
  prepareSupabaseAccess: () => ipcRenderer.invoke('data-store:supabase:prepare-access'),
  verifySupabaseData: () => ipcRenderer.invoke('data-store:supabase:verify'),
  enableSupabase: () => ipcRenderer.invoke('data-store:supabase:enable'),
  enableSqlite: () => ipcRenderer.invoke('data-store:sqlite:enable')
});
