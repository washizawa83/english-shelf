const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { StudyDatabase } = require('../src/database');

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const database = new StudyDatabase(path.join(__dirname, '..', 'data', 'english-study.db'));
  ipcMain.handle('entries:list', (_event, kind, query) => database.list(kind, query));
  ipcMain.handle('entries:get', (_event, kind, id) => database.get(kind, id));
  ipcMain.handle('entries:due', (_event, kind) => database.due(kind));
  ipcMain.handle('curriculum:list', () => database.listCurriculumUnits());
  ipcMain.handle('study-logs:list', () => database.listStudyLogs());
  ipcMain.handle('study-logs:get', (_event, id) => database.getStudyLog(id));
  ipcMain.handle('study-logs:update-note', (_event, id, userNote) => database.updateStudyLogNote(id, userNote));

  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window.setMenuBarVisibility(false);
  await window.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 500));
  const outputDirectory = path.join(__dirname, '..', 'artifacts');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const summaryPath = path.join(outputDirectory, 'react-summary.png');
  fs.writeFileSync(summaryPath, (await window.webContents.capturePage()).toPNG());

  const wordListChecks = await window.webContents.executeJavaScript(`
    (async () => {
      document.querySelector('[data-kind="words"]').click();
      await new Promise(resolve => setTimeout(resolve, 450));
      const card = document.querySelector('.word-entry-card');
      return {
        wordCount: document.querySelectorAll('.word-entry-card').length,
        inflectionChipCount: card?.querySelectorAll('.inflection-chip').length || 0,
        firstWordHasAllLabels: ['変形', '意味', '例文', '最終復習日', '忘却 Lv.'].every(label => card?.innerText.includes(label))
      };
    })()
  `);
  await new Promise(resolve => setTimeout(resolve, 250));
  window.webContents.invalidate();
  await new Promise(resolve => setTimeout(resolve, 100));
  const wordListPath = path.join(outputDirectory, 'react-word-library.png');
  fs.writeFileSync(wordListPath, (await window.webContents.capturePage()).toPNG());

  const wordDialogChecks = await window.webContents.executeJavaScript(`
    (async () => {
      document.querySelector('.word-entry-card').click();
      await new Promise(resolve => setTimeout(resolve, 180));
      return {
        closeCount: document.querySelectorAll('#entry-dialog .dialog-close').length,
        vocabulary: document.querySelector('[name="vocabulary"]')?.value,
        inflection: document.querySelector('[name="inflection"]')?.value,
        meaning: document.querySelector('[name="meaning"]')?.value,
        example: document.querySelector('[name="example"]')?.value,
        reviewDate: document.querySelector('[name="last_reviewed_at"]')?.value,
        forgettingLevelVisible: Boolean(document.querySelector('[name="forgetting_level"]'))
      };
    })()
  `);
  await new Promise(resolve => setTimeout(resolve, 250));
  const wordDialogPath = path.join(outputDirectory, 'react-word-edit.png');
  fs.writeFileSync(wordDialogPath, (await window.webContents.capturePage()).toPNG());

  const wordAddChecks = await window.webContents.executeJavaScript(`
    (async () => {
      document.querySelector('#entry-dialog .dialog-close').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      document.querySelector('#add-entry').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const wordAddHasInflection = Boolean(document.querySelector('[name="inflection"]'));
      const wordAddHasLevel = Boolean(document.querySelector('[name="forgetting_level"]'));
      const wordAddShowsFixedLevel = document.querySelector('.default-level-note')?.innerText.includes('レベル 1')
        && document.querySelector('.default-level-note')?.innerText.includes('自動更新');
      return { wordAddHasInflection, wordAddHasLevel, wordAddShowsFixedLevel };
    })()
  `);
  await new Promise(resolve => setTimeout(resolve, 200));
  window.webContents.invalidate();
  await new Promise(resolve => setTimeout(resolve, 100));
  const wordAddPath = path.join(outputDirectory, 'react-word-add.png');
  fs.writeFileSync(wordAddPath, (await window.webContents.capturePage()).toPNG());

  const sentenceChecks = await window.webContents.executeJavaScript(`
    (async () => {
      document.querySelector('#entry-dialog .dialog-close').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      document.querySelector('[data-kind="sentences"]').click();
      await new Promise(resolve => setTimeout(resolve, 250));
      document.querySelector('#add-entry').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        sentenceCloseCount: document.querySelectorAll('#entry-dialog .dialog-close').length,
        sentenceTitle: document.querySelector('#form-title')?.textContent,
        sentenceAddHasLevel: Boolean(document.querySelector('[name="forgetting_level"]')),
        sentenceAddShowsFixedLevel: document.querySelector('.default-level-note')?.innerText.includes('レベル 1')
      };
    })()
  `);
  console.log(JSON.stringify({ summaryPath, wordListPath, wordDialogPath, wordAddPath, ...wordListChecks, ...wordDialogChecks, ...wordAddChecks, ...sentenceChecks }));
  window.destroy();
  database.close();
  app.exit(0);
});
