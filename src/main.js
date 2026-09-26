const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createDataStore, createSelectedDataStore } = require('./data-store/factory');
const { StudyService } = require('./study-service');
const { createSupabaseSettingsStore, checkSupabaseConnection, validateSupabaseSettings } = require('./supabase-settings');
const { createMigrationPayload, createMigrationToken, createSetupSql, migrateToSupabase, migrationSummary, verificationView, fingerprint } = require('./supabase-migration');
const { createSupabaseRuntimeStore, createAccessToken, createSupabaseAccessSql } = require('./supabase-runtime');
const { SupabaseDataStore } = require('./data-store/supabase');

const dataDirectory = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDirectory, { recursive: true });
app.setPath('userData', dataDirectory);

let database;
let verifiedSupabaseSignature = '';
let pendingMigrationToken = '';

function settingsSignature(settings) { return `${settings.url}\n${settings.publishableKey}`; }

function createWindow() {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  window.setMenuBarVisibility(false);
  window.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const supabaseSettings = createSupabaseSettingsStore(app.getPath('userData'));
  const supabaseRuntime = createSupabaseRuntimeStore(app.getPath('userData'));
  const sqlitePath = path.join(app.getPath('userData'), 'english-study.db');
  database = new StudyService(await createSelectedDataStore({ defaultSqlitePath: sqlitePath }));
  const source = require('./imported-notion-data');
  const bodies = require('./notion-page-bodies');
  if (supabaseRuntime.load().activeStore === 'sqlite') {
    await database.importNotion('words', source.words, bodies);
    await database.importNotion('sentences', source.sentences, bodies);
  }
  ipcMain.handle('entries:list', (_event, kind, query) => database.list(kind, query));
  ipcMain.handle('entries:get', (_event, kind, id) => database.get(kind, id));
  ipcMain.handle('entries:save', (_event, kind, payload) => database.save(kind, payload));
  ipcMain.handle('entries:due', (_event, kind) => database.due(kind));
  ipcMain.handle('entries:review', (_event, kind, id, result) => database.review(kind, id, result));
  ipcMain.handle('curriculum:list', () => database.listCurriculumUnits());
  ipcMain.handle('curriculum:save', (_event, payload) => database.saveCurriculumUnit(payload));
  ipcMain.handle('curriculum:move', (_event, id, direction) => database.moveCurriculumUnit(id, direction));
  ipcMain.handle('curriculum:link', (_event, unitId, grammarItemId) => database.linkGrammarItem(unitId, grammarItemId));
  ipcMain.handle('curriculum:unlink', (_event, unitId, grammarItemId) => database.unlinkGrammarItem(unitId, grammarItemId));
  ipcMain.handle('study-logs:list', () => database.listStudyLogs());
  ipcMain.handle('study-logs:get', (_event, id) => database.getStudyLog(id));
  ipcMain.handle('study-logs:update-note', (_event, id, userNote) => database.updateStudyLogNote(id, userNote));
  ipcMain.handle('settings:supabase:get', () => supabaseSettings.load());
  ipcMain.handle('settings:supabase:save', (_event, input) => {
    if (supabaseRuntime.load().activeStore === 'supabase') throw new Error('接続設定を変更する前にSQLiteへ戻してください。');
    const saved = supabaseSettings.save(input);
    verifiedSupabaseSignature = '';
    pendingMigrationToken = '';
    return saved;
  });
  ipcMain.handle('settings:supabase:check', async (_event, input) => {
    const saved = supabaseSettings.load();
    const candidate = validateSupabaseSettings(input, { allowEmpty: false });
    if (settingsSignature(saved) !== settingsSignature(candidate)) throw new Error('先に現在の設定を保存してください。');
    const result = await checkSupabaseConnection(candidate);
    verifiedSupabaseSignature = settingsSignature(candidate);
    pendingMigrationToken = '';
    return result;
  });
  ipcMain.handle('migration:supabase:prepare', async () => {
    const saved = supabaseSettings.load();
    if (!verifiedSupabaseSignature || verifiedSupabaseSignature !== settingsSignature(saved)) throw new Error('保存済み設定の接続確認を先に実行してください。');
    pendingMigrationToken = createMigrationToken();
    const payload = await createMigrationPayload(database);
    return { setupSql: createSetupSql(pendingMigrationToken), counts: migrationSummary(payload) };
  });
  ipcMain.handle('migration:supabase:run', async () => {
    const saved = supabaseSettings.load();
    if (!pendingMigrationToken || verifiedSupabaseSignature !== settingsSignature(saved)) throw new Error('セットアップSQLを生成し、接続確認をやり直してください。');
    const payload = await createMigrationPayload(database);
    const result = await migrateToSupabase(saved, pendingMigrationToken, payload);
    pendingMigrationToken = '';
    return result;
  });
  ipcMain.handle('data-store:status', () => {
    const state = supabaseRuntime.load();
    return { activeStore: state.activeStore, migrationVerified: Boolean(state.verification) };
  });
  ipcMain.handle('data-store:supabase:prepare-access', () => {
    const saved = supabaseSettings.load();
    if (!verifiedSupabaseSignature || verifiedSupabaseSignature !== settingsSignature(saved)) throw new Error('保存済み設定の接続確認を先に実行してください。');
    const state = supabaseRuntime.load(), accessToken = createAccessToken();
    supabaseRuntime.save({ ...state, activeStore: 'sqlite', accessToken, verification: null });
    return { setupSql: createSupabaseAccessSql(accessToken) };
  });
  async function compareLocalAndSupabase() {
    const saved = supabaseSettings.load(), state = supabaseRuntime.load();
    if (!state.accessToken) throw new Error('Supabase利用SQLを生成し、SQL Editorで実行してください。');
    const localService = state.activeStore === 'sqlite' ? database : new StudyService(await createDataStore({ defaultSqlitePath: sqlitePath }));
    const remoteStore = new SupabaseDataStore(saved, state.accessToken), remoteService = new StudyService(remoteStore);
    try {
      const [localPayload, remotePayload] = await Promise.all([createMigrationPayload(localService), createMigrationPayload(remoteService)]);
      const localHash = fingerprint(verificationView(localPayload)), remoteHash = fingerprint(verificationView(remotePayload));
      if (localHash !== remoteHash) throw new Error('SQLiteとSupabaseの件数または内容が一致しません。SQLiteを維持します。');
      return { localHash, remoteHash, counts: migrationSummary(localPayload) };
    } finally { remoteStore.close(); if (state.activeStore !== 'sqlite') localService.close(); }
  }
  ipcMain.handle('data-store:supabase:verify', async () => {
    if (supabaseRuntime.load().activeStore !== 'sqlite') throw new Error('すでにSupabaseを使用中です。');
    const result = await compareLocalAndSupabase();
    const state = supabaseRuntime.load(); supabaseRuntime.save({ ...state, verification: { hash: result.remoteHash, counts: result.counts, verifiedAt: new Date().toISOString() } });
    return result;
  });
  ipcMain.handle('data-store:supabase:enable', async () => {
    const saved = supabaseSettings.load(), state = supabaseRuntime.load();
    if (!verifiedSupabaseSignature || verifiedSupabaseSignature !== settingsSignature(saved) || !state.verification) throw new Error('接続確認と移行データ照合を先に完了してください。');
    const result = await compareLocalAndSupabase();
    const nextStore = new SupabaseDataStore(saved, state.accessToken);
    const previous = database; database = new StudyService(nextStore);
    supabaseRuntime.save({ ...state, activeStore: 'supabase', verification: { hash: result.remoteHash, counts: result.counts, verifiedAt: new Date().toISOString() } });
    previous.close();
    return { activeStore: 'supabase', ...result };
  });
  ipcMain.handle('data-store:sqlite:enable', async () => {
    const nextStore = await createDataStore({ defaultSqlitePath: sqlitePath });
    const previous = database; database = new StudyService(nextStore);
    const state = supabaseRuntime.load(); supabaseRuntime.save({ ...state, activeStore: 'sqlite' });
    previous.close();
    return { activeStore: 'sqlite' };
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
