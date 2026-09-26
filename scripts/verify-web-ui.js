const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const root = path.join(__dirname, '..', 'dist', 'renderer');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

app.whenReady().then(async () => {
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filename = path.join(root, requested === '/' ? 'index.html' : requested.slice(1));
    if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) filename = path.join(root, 'index.html');
    response.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
    fs.createReadStream(filename).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const window = new BrowserWindow({ show: false, width: 390, height: 844, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  window.webContents.on('console-message', event => console.error(`[renderer:${event.level}] ${event.message}`));
  await window.loadURL(`http://127.0.0.1:${server.address().port}/`);
  const result = await window.webContents.executeJavaScript(`(async () => {
    await new Promise(resolve => setTimeout(resolve, 600));
    const settings = document.querySelector('#settings-view');
    const tabIcons = [...document.querySelectorAll('.tab-icon')];
    const tabLabels = [...document.querySelectorAll('.tab-label')];
    document.querySelector('[data-kind="summary"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    const activityGrid = document.querySelector('#study-activity-grid');
    const activityPanel = activityGrid?.closest('.activity-panel');
    document.querySelector('[data-kind="study-logs"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    const dateControl = document.querySelector('.date-input-control');
    const dateRect = dateControl?.getBoundingClientRect();
    const dateFitsViewport = Boolean(dateRect && dateRect.left >= 0 && dateRect.right <= document.documentElement.clientWidth);
    document.querySelector('[data-kind="settings"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 30));
    return {
      settingsVisible: Boolean(settings && !settings.hidden),
      startsOnSettings: document.querySelector('.tab.active')?.dataset.kind === 'settings',
      onlyPublicFields: settings?.querySelectorAll('#supabase-url, #supabase-publishable-key').length === 2,
      desktopMigrationHidden: !settings?.innerText.includes('SQLiteからSupabaseへ移行'),
      webSetupVisible: settings?.innerText.includes('SupabaseをWeb版で使用する'),
      diagnosticsRemoved: !settings?.querySelector('#web-diagnostics') && !settings?.innerText.includes('PWA接続診断'),
      activationDisabled: settings ? [...settings.querySelectorAll('button')].find(button => button.textContent === 'Supabaseを使用する')?.disabled === true : false,
      mobileViewportFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      mobileTabsUseIcons: tabIcons.length === 6
        && tabIcons.every(icon => getComputedStyle(icon).display !== 'none')
        && tabLabels.every(label => getComputedStyle(label).position === 'absolute'),
      activityFitsWithoutHorizontalScroll: Boolean(activityGrid && activityPanel)
        && activityGrid.scrollWidth <= activityPanel.clientWidth
        && activityGrid.getBoundingClientRect().right <= document.documentElement.clientWidth,
      dateControlFitsViewport: dateFitsViewport,
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
