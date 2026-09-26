const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const { StudyDatabase } = require('../src/database');
const verificationWidth = Number(process.env.ENGLISH_SHELF_VERIFY_WIDTH) || 320;

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
  ipcMain.handle('settings:supabase:get', () => ({ url: '', publishableKey: '' }));
  ipcMain.handle('settings:supabase:save', (_event, settings) => ({ url: settings.url || '', publishableKey: settings.publishableKey || '' }));
  ipcMain.handle('settings:supabase:check', () => ({ ok: true, message: 'Data APIへの読み取り接続を確認できました。' }));
  ipcMain.handle('data-store:status', () => ({ activeStore: 'sqlite', migrationVerified: false }));
  ipcMain.handle('data-store:supabase:prepare-access', () => ({ setupSql: '-- test access sql' }));
  ipcMain.handle('data-store:supabase:verify', () => ({ counts: { words: 31, sentences: 8, curriculum_units: 28, curriculum_unit_grammar_items: 0, study_logs: 2 } }));
  ipcMain.handle('data-store:supabase:enable', () => ({ activeStore: 'supabase' }));
  ipcMain.handle('data-store:sqlite:enable', () => ({ activeStore: 'sqlite' }));

  const window = new BrowserWindow({
    show: false,
    width: verificationWidth,
    height: 720,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window.setMenuBarVisibility(false);

  await window.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  const result = await window.webContents.executeJavaScript(`
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      const viewportWidth = window.innerWidth;
      const fitsViewport = element => { const rect = element?.getBoundingClientRect(); return Boolean(rect && rect.left >= 0 && rect.right <= viewportWidth); };
      const formFitsDialog = dialog => Boolean(dialog && fitsViewport(dialog)
        && dialog.scrollWidth <= dialog.clientWidth
        && [...dialog.querySelectorAll('input, textarea, button, [role="combobox"]')].every(fitsViewport));
      const summary = document.querySelector('#summary-view');
      const summaryInitial = !summary.hidden
        && document.querySelector('.tab.active')?.dataset.kind === 'summary'
        && document.querySelector('#summary-word-count')?.textContent === '31'
        && document.querySelector('#summary-sentence-count')?.textContent === '8'
        && document.querySelector('#summary-unit-count')?.textContent === '28'
        && document.querySelector('#summary-mastery-average')?.textContent === '3%'
        && document.querySelector('#summary-started-count')?.textContent === '1'
        && document.querySelector('#summary-completed-count')?.textContent === '0';
      const curriculumProgressSummary = document.querySelector('#summary-progress-label')?.textContent === '3%'
        && document.querySelector('#summary-mastery-bar')?.style.width === '3%'
        && document.querySelector('#summary-progress-started')?.textContent === '1'
        && document.querySelector('#summary-progress-completed')?.textContent === '0'
        && document.querySelector('#summary-progress-total')?.textContent === '28';
      const distributionGroups = document.querySelectorAll('#forgetting-distribution-chart .level-group');
      const wordDistributionTotal = [...document.querySelectorAll('#forgetting-distribution-chart .word-bar')]
        .reduce((sum, bar) => sum + Number(bar.previousElementSibling.textContent), 0);
      const sentenceDistributionTotal = [...document.querySelectorAll('#forgetting-distribution-chart .sentence-bar')]
        .reduce((sum, bar) => sum + Number(bar.previousElementSibling.textContent), 0);
      const distributionComplete = distributionGroups.length === 8
        && wordDistributionTotal === 31
        && sentenceDistributionTotal === 8
        && [...document.querySelectorAll('#forgetting-distribution-chart .bar-column > span')].some(value => value.textContent === '0');
      const reviewOnlyOnSummary = summary.contains(document.querySelector('#start-review'))
        && document.querySelectorAll('#start-review').length === 1;
      const largeHeaderAbsent = !document.querySelector('h1');
      const activityCells = summary.querySelectorAll('[data-filter-date]').length;
      const zeroActivityDaysVisible = summary.querySelectorAll('.activity-day.level-0').length > 0;
      const activityOnSummaryOnly = summary.contains(document.querySelector('#study-activity-grid'))
        && !document.querySelector('#study-log-view').contains(document.querySelector('#study-activity-grid'));
      summary.querySelector('[data-filter-date="2026-09-26"]')?.click();
      await new Promise(resolve => setTimeout(resolve, 120));
      const activityClickFilters = !document.querySelector('#study-log-view').hidden
        && document.querySelector('#study-log-date-filter')?.value === '2026-09-26'
        && document.querySelector('#study-log-count')?.textContent.includes('2 件');
      const summaryRouteClear = document.querySelector('#clear-study-log-date');
      const clearVisibleWhenFiltered = !summaryRouteClear.hidden && summaryRouteClear.textContent === '×';
      summaryRouteClear.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      const clearRestoresAll = document.querySelector('#study-log-date-filter').value === ''
        && document.querySelector('#study-log-count')?.textContent === '2 件'
        && summaryRouteClear.hidden
        && !document.querySelector('.activity-day.selected');
      document.querySelector('[data-kind="words"]').click();
      await new Promise(resolve => setTimeout(resolve, 300));
      const libraryUsesFullWidth = !document.querySelector('#library-workspace > .entry-panel')
        && Boolean(document.querySelector('#library-workspace > .library-list-panel'));
      const libraryTools = document.querySelector('.library-tools');
      const libraryToolsRect = libraryTools?.getBoundingClientRect();
      const searchRect = libraryTools?.querySelector('.search')?.getBoundingClientRect();
      const addButtonRect = document.querySelector('#add-entry')?.getBoundingClientRect();
      const libraryHeaderUsesFullWidth = Math.abs(searchRect.left - libraryToolsRect.left) < 0.5
        && Math.abs(addButtonRect.right - libraryToolsRect.right) < 0.5
        && Math.abs((addButtonRect.left - searchRect.right) - 18) < 0.5;
      const addButtonVisible = document.querySelector('#add-entry')?.textContent === '単語を追加';
      const firstWordCard = document.querySelector('.word-entry-card');
      const wordCardComplete = Boolean(firstWordCard?.querySelector('.inflection-chip'))
        && ['変形', '意味', '例文', '最終復習日', '忘却 Lv.'].every(label => firstWordCard.innerText.includes(label));
      const editIconButton = firstWordCard?.querySelector('[data-edit-entry]');
      const editUsesAccessibleIconButton = editIconButton?.innerText.trim() === ''
        && editIconButton?.getAttribute('aria-label') === '単語を編集'
        && editIconButton?.querySelector('svg')
        && editIconButton.getBoundingClientRect().width >= 40
        && editIconButton.getBoundingClientRect().height >= 40
        && getComputedStyle(editIconButton).borderColor === 'rgba(0, 0, 0, 0)';
      const wordFooter = firstWordCard?.querySelector('.entry-card-footer');
      const wordDate = wordFooter?.querySelector('.entry-review-date');
      const wordFooterStaysOnOneLine = getComputedStyle(wordFooter).display === 'flex'
        && getComputedStyle(wordDate).whiteSpace === 'nowrap'
        && getComputedStyle(editIconButton).flexShrink === '0'
        && Math.abs((wordDate.getBoundingClientRect().top + wordDate.getBoundingClientRect().bottom) / 2 - (editIconButton.getBoundingClientRect().top + editIconButton.getBoundingClientRect().bottom) / 2) < 1
        && wordFooter.scrollWidth <= wordFooter.clientWidth;
      const wordMeaningField = firstWordCard?.querySelector('.meaning-field');
      const wordHeightBeforeMeaningToggle = firstWordCard?.getBoundingClientRect().height;
      const wordMeaningHiddenByDefault = Boolean(wordMeaningField)
        && getComputedStyle(wordMeaningField.querySelector('.meaning-text')).visibility === 'hidden'
        && getComputedStyle(wordMeaningField.querySelector('.meaning-mask')).visibility === 'visible'
        && wordMeaningField.querySelector('[data-toggle-meaning]')?.getAttribute('aria-expanded') === 'false';
      const wordMeaningLabelPositions = [...firstWordCard.querySelectorAll('.entry-field > b')]
        .map(label => label.getBoundingClientRect().left);
      const wordMeaningLabelAligned = wordMeaningLabelPositions.length === 3
        && wordMeaningLabelPositions.every(left => Math.abs(left - wordMeaningLabelPositions[0]) < 0.5);
      const wordFieldStyle = getComputedStyle(wordMeaningField);
      const wordDetailSpacingCompact = parseFloat(wordFieldStyle.gridTemplateColumns) <= 42.5
        && parseFloat(wordFieldStyle.columnGap) <= 6.5;
      firstWordCard?.querySelector('[data-toggle-meaning]')?.click();
      await new Promise(resolve => setTimeout(resolve, 30));
      const wordMeaningCanToggle = getComputedStyle(wordMeaningField?.querySelector('.meaning-text')).visibility === 'visible'
        && getComputedStyle(wordMeaningField?.querySelector('.meaning-mask')).visibility === 'hidden'
        && wordMeaningField?.querySelector('[data-toggle-meaning]')?.getAttribute('aria-expanded') === 'true';
      const wordHeightStableOnMeaningToggle = Math.abs(firstWordCard.getBoundingClientRect().height - wordHeightBeforeMeaningToggle) < 0.5;
      document.querySelector('#add-entry')?.click();
      await new Promise(resolve => setTimeout(resolve, 80));
      const addDialog = document.querySelector('#entry-dialog');
      const addModalOpen = addDialog?.dataset.state === 'open';
      const wordAddModalFitsMobile = formFitsDialog(addDialog)
        && fitsViewport(addDialog?.querySelector('[name="last_reviewed_at"]'));
      const addForgettingLevelHidden = !addDialog?.querySelector('[name="forgetting_level"]');
      const addLevelOneExplanation = addDialog?.querySelector('.default-level-note')?.innerText.includes('レベル 1')
        && addDialog?.querySelector('.default-level-note')?.innerText.includes('自動更新');
      const addInflectionVisible = Boolean(addDialog?.querySelector('[name="inflection"]'));
      addDialog?.querySelector('.dialog-close')?.click();
      await new Promise(resolve => setTimeout(resolve, 80));
      document.querySelector('.word-entry-card')?.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      const cardClickDoesNotEdit = document.querySelector('#entry-dialog')?.dataset.state !== 'open';
      document.querySelector('.word-entry-card [data-edit-entry]')?.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const editDialog = document.querySelector('#entry-dialog');
      const editModalOpen = editDialog?.dataset.state === 'open';
      const editKeepsForgettingLevel = Boolean(editDialog?.querySelector('[name="forgetting_level"]'));
      editDialog?.querySelector('.dialog-close')?.click();
      document.querySelector('[data-kind="sentences"]')?.click();
      await new Promise(resolve => setTimeout(resolve, 250));
      const firstSentenceCard = document.querySelector('.sentence-entry-card');
      const sentenceMeaningField = firstSentenceCard?.querySelector('.meaning-field');
      const sentenceHeightBeforeMeaningToggle = firstSentenceCard?.getBoundingClientRect().height;
      const sentenceMeaningHiddenByDefault = Boolean(firstSentenceCard)
        && getComputedStyle(sentenceMeaningField?.querySelector('.meaning-text')).visibility === 'hidden'
        && getComputedStyle(sentenceMeaningField?.querySelector('.meaning-mask')).visibility === 'visible';
      const sentenceFieldStyle = getComputedStyle(sentenceMeaningField);
      const sentenceDetailSpacingCompact = parseFloat(sentenceFieldStyle.gridTemplateColumns) <= 42.5
        && parseFloat(sentenceFieldStyle.columnGap) <= 6.5;
      firstSentenceCard?.querySelector('[data-toggle-meaning]')?.click();
      await new Promise(resolve => setTimeout(resolve, 30));
      const sentenceMeaningCanToggle = getComputedStyle(sentenceMeaningField?.querySelector('.meaning-text')).visibility === 'visible'
        && sentenceMeaningField?.querySelector('[data-toggle-meaning]')?.getAttribute('aria-expanded') === 'true';
      const sentenceHeightStableOnMeaningToggle = Math.abs(firstSentenceCard.getBoundingClientRect().height - sentenceHeightBeforeMeaningToggle) < 0.5;
      const sentenceFooter = firstSentenceCard?.querySelector('.entry-card-footer');
      const sentenceDate = sentenceFooter?.querySelector('.entry-review-date');
      const sentenceEdit = sentenceFooter?.querySelector('[data-edit-entry]');
      const sentenceFooterStaysOnOneLine = sentenceDate?.innerText.includes('最終復習日')
        && firstSentenceCard?.querySelector('.level-badge')?.innerText.includes('忘却 Lv.')
        && getComputedStyle(sentenceDate).whiteSpace === 'nowrap'
        && getComputedStyle(sentenceEdit).flexShrink === '0'
        && Math.abs((sentenceDate.getBoundingClientRect().top + sentenceDate.getBoundingClientRect().bottom) / 2 - (sentenceEdit.getBoundingClientRect().top + sentenceEdit.getBoundingClientRect().bottom) / 2) < 1
        && sentenceFooter.scrollWidth <= sentenceFooter.clientWidth;
      document.querySelector('#add-entry')?.click();
      await new Promise(resolve => setTimeout(resolve, 80));
      const sentenceAddDialog = document.querySelector('#entry-dialog');
      const sentenceAddModalFitsMobile = sentenceAddDialog?.dataset.state === 'open'
        && formFitsDialog(sentenceAddDialog)
        && fitsViewport(sentenceAddDialog?.querySelector('[name="last_reviewed_at"]'));
      sentenceAddDialog?.querySelector('.dialog-close')?.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      document.querySelector('[data-kind="curriculum"]').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const library = document.querySelector('#library-workspace');
      const curriculum = document.querySelector('#curriculum-view');
      const addUiVisible = document.body.innerText.includes('単元を追加');
      const listHasOrderControls = Boolean(document.querySelector('[data-action="up"], [data-action="down"]'));
      const listHasMutationControls = Boolean(document.querySelector('#curriculum-view form, #curriculum-view select, [data-action="edit"], [data-action="link"], [data-action="unlink"]'));
      const editUiVisible = /単元を編集|変更を保存/.test(document.querySelector('#curriculum-view').innerText);
      const targetCard = [...document.querySelectorAll('.curriculum-card')].find(card => card.querySelector('h3')?.textContent === '英文の語順と主語・動詞');
      targetCard?.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      const detailView = document.querySelector('#curriculum-detail-view');
      const detailHeadings = [...detailView.querySelectorAll('section > h3')].map(heading => heading.textContent.trim());
      const exampleCount = detailView.querySelectorAll('.example-item').length;
      const practiceCount = detailView.querySelectorAll('.practice-item').length;
      const hintCount = detailView.querySelectorAll('.practice-item .hint-details').length;
      const answerCount = detailView.querySelectorAll('.practice-item .answer-details').length;
      const finishGuideVisible = detailView.querySelector('.finish-guide')?.innerText.includes('10問を1問ずつ出題します')
        && detailView.querySelector('.finish-guide')?.innerText.includes('正答数 × 10を目安に理解度を更新します');
      const masteryVisible = detailView.querySelector('.mastery-badge')?.innerText === '理解度 90%'
        && detailView.querySelector('.finish-status')?.innerText.includes('現在の理解度')
        && detailView.querySelector('.finish-status')?.innerText.includes('90%');
      const plainLanguageUnitOne = detailView.innerText.includes('主語のあとに動詞')
        && !['Subject', 'Verb', 'S + V', 'SV', 'SVO', '目的語', '文型'].some(term => detailView.innerText.includes(term));
      document.querySelector('#back-to-curriculum')?.click();
      const linkedUnitCard = [...document.querySelectorAll('.curriculum-card')].find(card => card.querySelector('h3')?.textContent === '形容詞・副詞');
      linkedUnitCard?.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      const unitHasStudyLog = detailView.innerText.includes('at と in の使い分け')
        && detailView.innerText.includes('場所と時の語順')
        && detailView.querySelectorAll('[data-detail-log-id]').length === 2;
      detailView.querySelector('[data-detail-log-id]')?.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const studyLogView = document.querySelector('#study-log-view');
      const studyLogVisible = !studyLogView.hidden && getComputedStyle(studyLogView).display !== 'none';
      const activityRemovedFromStudyLogs = !studyLogView.querySelector('#study-activity-grid');
      const studyLogDetailVisible = document.querySelector('#study-log-detail')?.innerText.includes('場所と時の語順')
        && document.querySelector('#study-log-detail')?.innerText.includes('学習したこと');
      const detailReplacesList = !studyLogView.querySelector('#study-log-list')
        && Boolean(studyLogView.querySelector('#back-to-study-logs'));
      const userNoteEditable = Boolean(studyLogView.querySelector('#study-log-user-note, [data-save-study-log-note]'));
      const masteryNoteHidden = !document.querySelector('#study-log-detail')?.innerText.includes('基本的な使い分けを確認')
        && !document.querySelector('#study-log-detail')?.innerText.includes('理解度メモ');
      const editableFields = [...studyLogView.querySelectorAll('input, textarea, select')];
      const studyLogContentReadOnly = editableFields.length === 1
        && editableFields[0].id === 'study-log-user-note'
        && !studyLogView.querySelector('[data-action="edit"], [data-action="delete"]');
      studyLogView.querySelector('#back-to-study-logs')?.click();
      await new Promise(resolve => setTimeout(resolve, 80));
      const dateInputBesideHeading = Boolean(studyLogView.querySelector('.study-log-heading #study-log-date-filter'));
      const listRestoredByBack = Boolean(studyLogView.querySelector('#study-log-list'))
        && !studyLogView.querySelector('#study-log-detail');
      const firstStudyLogCard = studyLogView.querySelector('[data-study-log-id]');
      const studyLogCardLeftAligned = getComputedStyle(firstStudyLogCard).textAlign === 'left'
        && getComputedStyle(firstStudyLogCard).justifyItems === 'start'
        && [...firstStudyLogCard.children].every(child => getComputedStyle(child).textAlign === 'left');
      firstStudyLogCard?.click();
      await new Promise(resolve => setTimeout(resolve, 80));
      const listItemOpensDetail = Boolean(studyLogView.querySelector('#study-log-detail'))
        && !studyLogView.querySelector('#study-log-list');
      const relatedUnitLinkVisible = Boolean(studyLogView.querySelector('[data-related-unit-id]'));
      studyLogView.querySelector('[data-related-unit-id]')?.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const returnedToRelatedUnit = !detailView.hidden && detailView.querySelector('h2')?.textContent === '形容詞・副詞';
      const detailWasVisible = !detailView.hidden && getComputedStyle(detailView).display !== 'none';
      document.querySelector('[data-kind="settings"]')?.click();
      await new Promise(resolve => setTimeout(resolve, 80));
      const settingsView = document.querySelector('#settings-view');
      const settingsVisible = !settingsView.hidden && getComputedStyle(settingsView).display !== 'none';
      const settingsFieldsSafe = settingsView.querySelectorAll('input').length === 2
        && Boolean(settingsView.querySelector('#supabase-url'))
        && settingsView.querySelector('#supabase-publishable-key')?.type === 'password'
        && !settingsView.querySelector('[name*="secret" i], [name*="service" i], [name*="password" i]');
      const sqliteDefaultVisible = settingsView.innerText.includes('SQLiteが既定')
        && settingsView.innerText.includes('接続先は自動で切り替わりません');
      const migrationDisabledBeforeVerification = [...settingsView.querySelectorAll('button')]
        .find(button => button.textContent.includes('セットアップSQLを生成'))?.disabled === true;
      const supabaseUseDisabledBeforeVerification = [...settingsView.querySelectorAll('button')]
        .find(button => button.textContent === 'Supabaseを使用する')?.disabled === true;
      const switchExplanationVisible = settingsView.innerText.includes('新規追加・更新・復習・学習記録')
        || settingsView.innerText.includes('接続確認と移行データ照合が完了するまで切替できません');
      return {
        summaryInitial,
        curriculumProgressSummary,
        distributionComplete,
        reviewOnlyOnSummary,
        largeHeaderAbsent,
        libraryUsesFullWidth,
        libraryHeaderUsesFullWidth,
        addButtonVisible,
        wordCardComplete,
        editUsesAccessibleIconButton,
        wordFooterStaysOnOneLine,
        wordMeaningHiddenByDefault,
        wordMeaningLabelAligned,
        wordDetailSpacingCompact,
        wordMeaningCanToggle,
        wordHeightStableOnMeaningToggle,
        addModalOpen,
        wordAddModalFitsMobile,
        addForgettingLevelHidden,
        addLevelOneExplanation,
        addInflectionVisible,
        cardClickDoesNotEdit,
        editModalOpen,
        editKeepsForgettingLevel,
        sentenceMeaningHiddenByDefault,
        sentenceDetailSpacingCompact,
        sentenceMeaningCanToggle,
        sentenceHeightStableOnMeaningToggle,
        sentenceFooterStaysOnOneLine,
        sentenceAddModalFitsMobile,
        libraryHidden: library.hidden,
        libraryDisplay: getComputedStyle(library).display,
        curriculumHidden: curriculum.hidden,
        curriculumDisplay: getComputedStyle(curriculum).display,
        activeTab: document.querySelector('.tab.active')?.dataset.kind,
        addUiVisible,
        listHasOrderControls,
        listHasMutationControls,
        editUiVisible,
        detailVisible: detailWasVisible,
        detailHeadings,
        exampleCount,
        practiceCount,
        hintCount,
        answerCount,
        finishGuideVisible,
        masteryVisible,
        plainLanguageUnitOne,
        unitHasStudyLog,
        studyLogVisible,
        activityCells,
        zeroActivityDaysVisible,
        activityOnSummaryOnly,
        activityClickFilters,
        clearVisibleWhenFiltered,
        clearRestoresAll,
        activityRemovedFromStudyLogs,
        dateInputBesideHeading,
        studyLogDetailVisible,
        detailReplacesList,
        listRestoredByBack,
        studyLogCardLeftAligned,
        listItemOpensDetail,
        userNoteEditable,
        masteryNoteHidden,
        studyLogContentReadOnly,
        relatedUnitLinkVisible,
        returnedToRelatedUnit,
        settingsVisible,
        settingsFieldsSafe,
        sqliteDefaultVisible,
        migrationDisabledBeforeVerification,
        supabaseUseDisabledBeforeVerification,
        switchExplanationVisible,
        detailHasManualControls: Boolean(detailView.querySelector('form, select, input, textarea, [data-action="up"], [data-action="down"]')),
        hasPreviousOrNextUnit: /前の単元|次の単元/.test(detailView.innerText)
      };
    })()
  `);
  result.menuBarVisible = window.isMenuBarVisible();

  console.log(JSON.stringify(result));
  const passed = result.libraryHidden
    && result.summaryInitial
    && result.curriculumProgressSummary
    && result.distributionComplete
    && result.reviewOnlyOnSummary
    && result.largeHeaderAbsent
    && result.libraryUsesFullWidth
    && result.libraryHeaderUsesFullWidth
    && result.addButtonVisible
    && result.wordCardComplete
    && result.editUsesAccessibleIconButton
    && result.wordFooterStaysOnOneLine
    && result.wordMeaningHiddenByDefault
    && result.wordMeaningLabelAligned
    && result.wordDetailSpacingCompact
    && result.wordMeaningCanToggle
    && result.wordHeightStableOnMeaningToggle
    && result.addModalOpen
    && result.wordAddModalFitsMobile
    && result.addForgettingLevelHidden
    && result.addLevelOneExplanation
    && result.addInflectionVisible
    && result.cardClickDoesNotEdit
    && result.editModalOpen
    && result.editKeepsForgettingLevel
    && result.sentenceMeaningHiddenByDefault
    && result.sentenceDetailSpacingCompact
    && result.sentenceMeaningCanToggle
    && result.sentenceHeightStableOnMeaningToggle
    && result.sentenceFooterStaysOnOneLine
    && result.sentenceAddModalFitsMobile
    && !result.menuBarVisible
    && result.libraryDisplay === 'none'
    && result.curriculumHidden
    && result.curriculumDisplay === 'none'
    && result.activeTab === 'settings'
    && !result.addUiVisible
    && !result.listHasOrderControls
    && !result.listHasMutationControls
    && !result.editUiVisible
    && result.detailVisible
    && result.detailHeadings.length === 7
    && result.detailHeadings[3] === '04例文'
    && result.detailHeadings[4] === '05ミニ練習'
    && result.detailHeadings[5] === '06仕上げ'
    && result.detailHeadings[6] === '07関連する英文メモ'
    && result.exampleCount === 5
    && result.practiceCount === 5
    && result.hintCount === 5
    && result.answerCount === 5
    && result.finishGuideVisible
    && result.masteryVisible
    && result.plainLanguageUnitOne
    && result.unitHasStudyLog
    && result.studyLogVisible
    && result.activityCells === 371
    && result.zeroActivityDaysVisible
    && result.activityOnSummaryOnly
    && result.activityClickFilters
    && result.clearVisibleWhenFiltered
    && result.clearRestoresAll
    && result.activityRemovedFromStudyLogs
    && result.dateInputBesideHeading
    && result.studyLogDetailVisible
    && result.detailReplacesList
    && result.listRestoredByBack
    && result.studyLogCardLeftAligned
    && result.listItemOpensDetail
    && result.userNoteEditable
    && result.masteryNoteHidden
    && result.studyLogContentReadOnly
    && result.relatedUnitLinkVisible
    && result.returnedToRelatedUnit
    && result.settingsVisible
    && result.settingsFieldsSafe
    && result.sqliteDefaultVisible
    && result.migrationDisabledBeforeVerification
    && result.supabaseUseDisabledBeforeVerification
    && result.switchExplanationVisible
    && !result.detailHeadings.some(heading => heading.includes('参考リンク'))
    && !result.detailHasManualControls
    && !result.hasPreviousOrNextUnit;

  window.destroy();
  database.close();
  app.exit(passed ? 0 : 1);
});
