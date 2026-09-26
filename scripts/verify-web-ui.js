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
    return {
      settingsVisible: Boolean(settings && !settings.hidden),
      startsOnSettings: document.querySelector('.tab.active')?.dataset.kind === 'settings',
      onlyPublicFields: settings?.querySelectorAll('#supabase-url, #supabase-publishable-key').length === 2,
      desktopMigrationHidden: !settings?.innerText.includes('SQLiteからSupabaseへ移行'),
      webSetupVisible: settings?.innerText.includes('SupabaseをWeb版で使用する'),
      diagnosticsVisible: settings?.querySelector('#web-diagnostics')?.innerText.includes('Build 2026.09.26.5'),
      activationDisabled: settings ? [...settings.querySelectorAll('button')].find(button => button.textContent === 'Supabaseを使用する')?.disabled === true : false,
      mobileViewportFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
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
