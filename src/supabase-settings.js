const fs = require('node:fs');
const path = require('node:path');

const SETTINGS_FILENAME = 'supabase-settings.json';

function normalizeSupabaseUrl(value) {
  const raw = String(value || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  if (!raw) return '';
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Supabase URLの形式が正しくありません。'); }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new Error('Supabase URLはHTTPSを指定してください。');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Supabase URLに認証情報、クエリ、フラグメントは含められません。');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '') || '/';
  return parsed.toString().replace(/\/$/, '');
}

function validatePublishableKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  if (/service[_-]?role|sb_secret_/i.test(key)) {
    throw new Error('Secret KeyやService Role Keyは保存できません。Publishable Keyだけを指定してください。');
  }
  if (!/^sb_publishable_[A-Za-z0-9._-]{8,}$/.test(key)) {
    throw new Error('Publishable Keyは「sb_publishable_」で始まる公開キーを指定してください。');
  }
  return key;
}

function validateSupabaseSettings(input, { allowEmpty = true } = {}) {
  const url = normalizeSupabaseUrl(input?.url);
  const publishableKey = validatePublishableKey(input?.publishableKey);
  if (!allowEmpty && (!url || !publishableKey)) throw new Error('Supabase URLとPublishable Keyを入力してください。');
  if ((url && !publishableKey) || (!url && publishableKey)) throw new Error('Supabase URLとPublishable Keyは両方入力してください。');
  return { url, publishableKey };
}

function createSupabaseSettingsStore(userDataPath, { fileSystem = fs } = {}) {
  const filename = path.join(userDataPath, SETTINGS_FILENAME);
  return {
    filename,
    load() {
      if (!fileSystem.existsSync(filename)) return { url: '', publishableKey: '' };
      try {
        const stored = JSON.parse(fileSystem.readFileSync(filename, 'utf8'));
        return validateSupabaseSettings(stored);
      } catch (error) {
        if (error instanceof SyntaxError) throw new Error('Supabase設定ファイルを読み込めませんでした。');
        throw error;
      }
    },
    save(input) {
      const settings = validateSupabaseSettings(input);
      fileSystem.mkdirSync(userDataPath, { recursive: true });
      fileSystem.writeFileSync(filename, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      return settings;
    }
  };
}

async function checkSupabaseConnection(input, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const settings = validateSupabaseSettings(input, { allowEmpty: false });
  if (typeof fetchImpl !== 'function') throw new Error('この環境では接続確認を利用できません。');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${settings.url}/rest/v1/__english_shelf_connection_probe__?select=id&limit=0`, {
      method: 'GET',
      headers: { apikey: settings.publishableKey, Accept: 'application/json' },
      signal: controller.signal
    });
    if (response.ok) return { ok: true, message: `Data APIへの読み取り接続を確認できました（HTTP ${response.status}）。`, checkedAt: new Date().toISOString() };
    const body = typeof response.text === 'function' ? await response.text() : '';
    let detail = {};
    try { detail = JSON.parse(body); } catch { detail = {}; }
    if (response.status === 404 && /^PGRST\d+$/i.test(String(detail.code || ''))) {
      return { ok: true, message: `Data APIへの読み取り接続を確認できました（HTTP 404 / ${detail.code}：安全な確認用テーブルが存在しない想定どおりの応答）。`, checkedAt: new Date().toISOString() };
    }
    if (response.status === 401) throw new Error('接続確認失敗（HTTP 401）: Publishable Keyが無効、削除済み、または別プロジェクトのキーです。Supabase DashboardのConnectまたはSettings > API Keysから同じプロジェクトのキーをコピーしてください。');
    if (response.status === 403) throw new Error('接続確認失敗（HTTP 403）: APIゲートウェイが拒否しました。Publishable KeyとプロジェクトURLの組み合わせ、Data APIの公開設定を確認してください。RLSはこの確認用リクエストの原因ではありません。');
    if (response.status === 404) throw new Error('接続確認失敗（HTTP 404）: Data APIが見つかりません。Project URLを確認し、Data APIが有効か確認してください。Data API URLを貼り付けた場合の「/rest/v1」は自動で正規化されます。');
    if (response.status >= 500) throw new Error(`接続確認失敗（HTTP ${response.status}）: Supabaseプロジェクトが一時停止中、起動中、またはData APIが一時的に利用できない可能性があります。`);
    const serverMessage = String(detail.message || detail.msg || '').slice(0, 180);
    throw new Error(`接続確認失敗（HTTP ${response.status}）: ${serverMessage || 'Data APIから想定外の応答が返されました。URL、キー、Data API設定を確認してください。'} この確認はElectronメインプロセスから行うため、ブラウザのCORS設定は原因になりません。`);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('接続確認がタイムアウトしました。');
    if (error instanceof TypeError || /fetch failed|ENOTFOUND|ECONNREFUSED|certificate/i.test(String(error.message))) {
      const code = error.cause?.code ? ` (${error.cause.code})` : '';
      throw new Error(`接続確認失敗${code}: Supabase URL、ネットワーク、DNS、プロキシ、証明書を確認してください。この確認はElectronメインプロセスから行うため、ブラウザのCORS設定は原因になりません。`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  SETTINGS_FILENAME,
  normalizeSupabaseUrl,
  validatePublishableKey,
  validateSupabaseSettings,
  createSupabaseSettingsStore,
  checkSupabaseConnection
};
