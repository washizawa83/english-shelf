const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const root = path.join(__dirname, '..', 'dist', 'renderer');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const verificationApi = `window.studyApi={platform:'web',initialView:'summary',list:async()=>[],get:async()=>null,save:async()=>null,due:async()=>[],review:async()=>null,listCurriculum:async()=>[],listStudyLogs:async()=>[],getStudyLog:async()=>null,updateStudyLogNote:async()=>null,getSupabaseSettings:async()=>({url:'',publishableKey:''}),saveSupabaseSettings:async value=>value,checkSupabaseConnection:async()=>({ok:true,message:''}),getDataStoreStatus:async()=>({activeStore:'supabase',migrationVerified:true}),prepareSupabaseAccess:async()=>({setupSql:''}),verifySupabaseData:async()=>({counts:{words:0,sentences:0,curriculum_units:0,curriculum_unit_grammar_items:0,study_logs:0}}),enableSupabase:async()=>({activeStore:'supabase'}),enableSqlite:async()=>({activeStore:'sqlite'})};`;

app.whenReady().then(async () => {
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (requested === '/verify-api.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(verificationApi); return; }
    let filename = path.join(root, requested === '/' ? 'index.html' : requested.slice(1));
    if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) filename = path.join(root, 'index.html');
    response.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
    if (filename.endsWith('index.html')) { response.end(fs.readFileSync(filename, 'utf8').replace('</head>', '<script src="/verify-api.js"></script></head>')); return; }
    fs.createReadStream(filename).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const window = new BrowserWindow({ show: false, width: 320, height: 720, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  window.webContents.on('console-message', event => console.error(`[renderer:${event.level}] ${event.message}`));
  await window.loadURL(`http://127.0.0.1:${server.address().port}/`);
  const result = await window.webContents.executeJavaScript(`(async () => {
    await new Promise(resolve => setTimeout(resolve, 600));
    const settings = document.querySelector('#settings-view');
    const pageRects = [];
    const recordPage = element => { const rect = element?.getBoundingClientRect(); if (rect?.width) pageRects.push({ left: rect.left, right: rect.right, width: rect.width }); };
    const tabIcons = [...document.querySelectorAll('.tab-icon')];
    const tabLabels = [...document.querySelectorAll('.tab-label')];
    const storageBadge = document.querySelector('.local-badge');
    const supabaseStorageBadgeAccurate = storageBadge?.dataset.activeStore === 'supabase'
      && storageBadge.innerText.includes('Supabaseに保存')
      && !/https?:|publishable|key/i.test(storageBadge.innerText)
      && storageBadge.getBoundingClientRect().right <= document.documentElement.clientWidth;
    const setDateValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const verifyDateInput = async input => {
      if (!input) return false;
      const update = async value => {
        setDateValue.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 40));
      };
      await update('');
      const shell = input.closest('.date-input-shell');
      const emptyState = shell?.classList.contains('is-empty') && shell.querySelector('.date-input-placeholder')?.textContent === '日付を選択';
      await update('2026-09-26');
      const selectedState = input.value === '2026-09-26' && !shell.classList.contains('is-empty') && !shell.querySelector('.date-input-placeholder');
      await update('');
      const clearedState = input.value === '' && shell.classList.contains('is-empty') && shell.querySelector('.date-input-placeholder')?.textContent === '日付を選択';
      return emptyState && selectedState && clearedState;
    };
    document.querySelector('[data-kind="summary"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    recordPage(document.querySelector('#summary-view'));
    const activityGrid = document.querySelector('#study-activity-grid');
    const activityPanel = activityGrid?.closest('.activity-panel');
    document.querySelector('[data-kind="study-logs"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    recordPage(document.querySelector('#study-log-view'));
    const dateControl = document.querySelector('.date-input-control');
    const dateFilter = document.querySelector('.date-filter');
    const dateFilterStyle = getComputedStyle(dateFilter);
    const dateShellStyle = getComputedStyle(dateFilter.querySelector('.date-input-shell'));
    const dateFilterUnframed = dateFilter?.querySelector('.date-filter-label')?.textContent === '日付指定'
      && !dateFilter.querySelector('.ui-label')
      && parseFloat(dateFilterStyle.borderTopWidth) === 0
      && dateFilterStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
      && dateShellStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
      && parseFloat(dateShellStyle.paddingTop) === 0;
    const dateInput = document.querySelector('#study-log-date-filter');
    const initialDatePlaceholderVisible = document.querySelector('.date-input-placeholder')?.innerText === '日付を選択'
      && dateInput?.value === '';
    const dateRect = dateControl?.getBoundingClientRect();
    const dateInputRect = dateInput?.getBoundingClientRect();
    setDateValue.call(dateInput, '2026-09-26');
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 80));
    const dateClear = document.querySelector('#clear-study-log-date');
    const dateClearRect = dateClear?.getBoundingClientRect();
    const selectedDatePresentation = dateInput.value === '2026-09-26'
      && !document.querySelector('.date-input-placeholder')
      && !dateClear.hidden;
    const viewportWidth = document.documentElement.clientWidth;
    const dateFitsViewport = Boolean(dateRect && dateInputRect && dateClearRect
      && dateRect.left >= 0 && dateRect.right <= viewportWidth
      && dateInputRect.left >= 0 && dateInputRect.right <= viewportWidth
      && dateClearRect.left >= 0 && dateClearRect.right <= viewportWidth
      && dateControl.scrollWidth <= dateControl.clientWidth
      && !dateClear.hidden);
    dateClear.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    const clearedDatePresentation = dateInput.value === ''
      && document.querySelector('.date-input-placeholder')?.innerText === '日付を選択'
      && document.querySelector('#clear-study-log-date')?.hidden;
    const studyLogDateConsistent = await verifyDateInput(dateInput);
    document.querySelector('[data-kind="words"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    recordPage(document.querySelector('#library-workspace'));
    const wordLevelFilter = document.querySelector('#forgetting-level-filter');
    const mobileLevelFilterFits = wordLevelFilter?.options.length === 9
      && wordLevelFilter.getBoundingClientRect().right <= document.documentElement.clientWidth
      && wordLevelFilter.closest('.library-tools').scrollWidth <= wordLevelFilter.closest('.library-tools').clientWidth;
    wordLevelFilter.value = '3';
    wordLevelFilter.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 40));
    document.querySelector('#add-entry')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    const wordDateInput = document.querySelector('#entry-dialog [name="last_reviewed_at"]');
    const wordAddDateConsistent = await verifyDateInput(wordDateInput);
    const wordDateFitsViewport = wordDateInput?.closest('.date-input-shell').getBoundingClientRect().right <= document.documentElement.clientWidth;
    document.querySelector('#entry-dialog .dialog-close')?.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    document.querySelector('[data-kind="sentences"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    recordPage(document.querySelector('#library-workspace'));
    const sentenceLevelFilter = document.querySelector('#forgetting-level-filter');
    const sentenceFilterStartsIndependently = sentenceLevelFilter?.value === 'all';
    sentenceLevelFilter.value = '4';
    sentenceLevelFilter.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 40));
    document.querySelector('#add-entry')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    const sentenceDateInput = document.querySelector('#entry-dialog [name="last_reviewed_at"]');
    const sentenceAddDateConsistent = await verifyDateInput(sentenceDateInput);
    const sentenceDateFitsViewport = sentenceDateInput?.closest('.date-input-shell').getBoundingClientRect().right <= document.documentElement.clientWidth;
    document.querySelector('#entry-dialog .dialog-close')?.click();
    document.querySelector('[data-kind="words"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    const mobileLevelFiltersPersist = document.querySelector('#forgetting-level-filter')?.value === '3';
    document.querySelector('[data-kind="curriculum"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    recordPage(document.querySelector('#curriculum-view'));
    document.querySelector('[data-kind="settings"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 30));
    recordPage(settings);
    const pageContainersConsistent = pageRects.length === 6
      && pageRects.every(rect => rect.left >= 0 && rect.right <= document.documentElement.clientWidth)
      && Math.max(...pageRects.map(rect => rect.width)) - Math.min(...pageRects.map(rect => rect.width)) < 1
      && Math.max(...pageRects.map(rect => rect.left)) - Math.min(...pageRects.map(rect => rect.left)) < 1;
    return {
      settingsVisible: Boolean(settings && !settings.hidden),
      startsOnSettings: document.querySelector('.tab.active')?.dataset.kind === 'settings',
      onlyPublicFields: settings?.querySelectorAll('#supabase-url, #supabase-publishable-key').length === 2,
      desktopMigrationHidden: !settings?.innerText.includes('SQLiteからSupabaseへ移行'),
      webSetupVisible: settings?.innerText.includes('SupabaseをWeb版で使用する'),
      diagnosticsRemoved: !settings?.querySelector('#web-diagnostics') && !settings?.innerText.includes('PWA接続診断'),
      activeSupabaseStateVisible: settings?.innerText.includes('Supabaseを使用中')
        && ![...settings.querySelectorAll('button')].some(button => button.textContent === 'Supabaseを使用する'),
      supabaseStorageBadgeAccurate,
      mobileViewportFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      mobileTabsUseIcons: tabIcons.length === 6
        && tabIcons.every(icon => getComputedStyle(icon).display !== 'none')
        && tabLabels.every(label => getComputedStyle(label).position === 'absolute'),
      activityFitsWithoutHorizontalScroll: Boolean(activityGrid && activityPanel)
        && activityGrid.scrollWidth <= activityPanel.clientWidth
        && activityGrid.getBoundingClientRect().right <= document.documentElement.clientWidth,
      dateControlFitsViewport: dateFitsViewport,
      dateFilterUnframed,
      initialDatePlaceholderVisible,
      selectedDatePresentation,
      clearedDatePresentation,
      studyLogDateConsistent,
      wordAddDateConsistent,
      wordDateFitsViewport,
      sentenceAddDateConsistent,
      sentenceDateFitsViewport,
      mobileLevelFilterFits,
      sentenceFilterStartsIndependently,
      mobileLevelFiltersPersist,
      pageContainersConsistent,
      pullRefreshAvailable: Boolean(document.querySelector('.pull-refresh')),
      manifestLinked: Boolean(document.querySelector('link[rel="manifest"]')),
      touchIconLinked: Boolean(document.querySelector('link[rel="apple-touch-icon"]')),
      bodyText: document.body.innerText.slice(0, 200)
    };
  })()`);
  result.pwaFiles = ['manifest.webmanifest', 'service-worker.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'].every(file => fs.existsSync(path.join(root, file)));
  console.log(JSON.stringify(result));
  const passed = Object.entries(result).filter(([key]) => key !== 'bodyText').every(([, value]) => Boolean(value));
  window.destroy(); server.close(); app.exit(passed ? 0 : 1);
});
