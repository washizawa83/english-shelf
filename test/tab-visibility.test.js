const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src', 'renderer', 'App.jsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'renderer', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('renderer is mounted with React and built by Vite', () => {
  assert.match(html, /id="root"/);
  assert.match(html, /type="module" src="\.\/main\.jsx"/);
  assert.match(pkg.scripts['build:renderer'], /vite build/);
  assert.match(pkg.dependencies.react, /^\^19/);
  assert.match(pkg.dependencies['@radix-ui/react-dialog'], /^\^1/);
});

test('main views preserve stable ids and tab routing', () => {
  for (const id of ['summary-view', 'library-workspace', 'curriculum-view', 'curriculum-detail-view', 'study-log-view']) {
    assert.match(app, new RegExp(`id="${id}"`));
  }
  for (const kind of ['summary', 'words', 'sentences', 'curriculum', 'study-logs']) {
    assert.match(app, new RegExp(`'${kind}'`));
  }
  assert.match(app, /view !== 'summary'/);
  assert.match(app, /view !== 'curriculum-detail'/);
});

test('sentence-facing copy consistently uses 英文', () => {
  assert.doesNotMatch(app, /英文・文法|英文文法/);
  assert.match(app, /sentences: \{ singular: '英文', heading: '英文一覧'/);
  assert.match(app, /<Label>英文<Textarea name="title"/);
});

test('summary retains metrics, review distribution, progress, and activity graph', () => {
  for (const id of ['summary-word-count', 'summary-sentence-count', 'summary-unit-count', 'summary-mastery-average', 'summary-started-count', 'summary-completed-count', 'summary-progress-label', 'summary-mastery-bar', 'forgetting-distribution-chart', 'study-activity-grid']) {
    assert.match(app, new RegExp(id));
  }
  assert.match(app, /Array\(8\)\.fill\(0\)/);
  assert.match(app, /53 \* 7/);
  assert.match(app, /unit\.status !== '未着手'/);
  assert.match(app, /Number\(unit\.mastery_percent\) === 100/);
  assert.doesNotMatch(app, /DAILY ACTIVITY|CURRICULUM PROGRESS|REVIEW LEVELS/);
  assert.match(app, /学習の積み重ね/);
  assert.match(app, /カリキュラム進捗/);
  assert.match(app, /忘却レベルの分布/);
});

test('entry forms use Shadcn-style primitives and default new records to level one', () => {
  assert.match(app, /<DialogContent id="entry-dialog"/);
  assert.match(app, /<Input name="vocabulary"/);
  assert.match(app, /<Textarea name="title"/);
  assert.match(app, /<Select name="forgetting_level"/);
  assert.match(app, /forgetting_level: 1/);
  assert.match(app, /editing \? <Label className="forgetting-level-field"/);
  assert.match(app, /新規項目はレベル1で登録され、復習結果に応じて自動更新されます/);
  assert.doesNotMatch(app, /id="cancel-edit"/);
  const dialog = fs.readFileSync(path.join(root, 'src', 'renderer', 'components', 'ui', 'dialog.jsx'), 'utf8');
  assert.match(dialog, /className="dialog-close"/);
});

test('word cards and forms expose every Notion word property', () => {
  for (const property of ['vocabulary', 'inflection', 'meaning', 'example', 'last_reviewed_at', 'forgetting_level']) {
    assert.match(app, new RegExp(property));
  }
  assert.match(app, /className="entry-field"><b>変形<\/b>/);
  assert.match(app, /splitInflections\(entry\.inflection\)/);
  assert.match(app, /className="inflection-chip"/);
  assert.match(app, /placeholder="例: go \/ goes \/ went \/ gone"/);
  assert.match(app, /Notionの「変形」にそのまま保存されます/);
  assert.match(app, /<b>最終復習日<\/b>/);
  assert.match(app, /className="entry-review-date"><b>最終復習日<\/b> \{formatReviewDate\(entry\.last_reviewed_at\)\}/);
  assert.match(app, /if \(!value\) return '未復習'/);
  assert.match(app, /忘却 Lv\./);
  assert.match(app, /data-toggle-meaning/);
  assert.match(app, /data-edit-entry/);
  assert.match(app, /className="entry-edit-button"/);
  assert.match(app, /aria-label=\{`\$\{word \? '単語' : '英文'\}を編集`\}/);
  assert.match(app, /useState\(false\)/);
  assert.match(app, /meaning-mask/);
  assert.match(app, /••••••/);
  assert.match(app, /meaning-text\$\{meaningVisible \? '' : ' concealed'\}/);
});

test('mobile navigation uses icons and pull-to-refresh is connected', () => {
  assert.match(app, /label: '英文', Icon: BookText/);
  assert.match(app, /className="tab-icon"/);
  assert.match(app, /className="tab-label"/);
  assert.match(app, /className=\{`pull-refresh/);
  assert.match(app, /onTouchStart=\{event => \{ beginPull\(event\);/);
  assert.match(app, /onTouchMove=\{event => \{ movePull\(event\);/);
  assert.match(app, /onTouchEnd=\{event => \{ detailSwipeBack\.onTouchEnd\(event\); finishPull\(\);/);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*\.tabs \{[^}]*position:fixed;[^}]*bottom:0;/);
  assert.match(css, /grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css, /\.tab-label \{[^}]*position:static;/);
});

test('tabs use only a bottom active indicator', () => {
  const styles = fs.readFileSync(path.join(root, 'src', 'renderer', 'styles.css'), 'utf8');
  assert.match(styles, /\.tab\.ui-button \{[^}]*border:0;[^}]*border-bottom:3px solid transparent;/);
  assert.match(styles, /\.tab\.active \{[^}]*border-bottom-color:var\(--accent\)/);
  assert.doesNotMatch(styles, /\.tab\.active \{[^}]*border-color:/);
});

test('curriculum remains read-only and keeps all seven sections', () => {
  assert.doesNotMatch(app, /saveCurriculum|moveCurriculum|linkCurriculumGrammar|unlinkCurriculumGrammar/);
  const headings = ['01', '02', '03', '04', '05', '06', '07'];
  headings.forEach(number => assert.match(app, new RegExp(`number="${number}"`)));
  assert.match(app, /title="練習問題"/);
  assert.doesNotMatch(app, /ミニ練習/);
  assert.match(app, /10問を1問ずつ出題し/);
  assert.match(app, /1〜3問目は4択の選択問題/);
  assert.match(app, /4〜7問目は、疑問文・否定文・時制などを変える英文変形問題/);
  assert.match(app, /8〜10問目は、和文を英文にする問題/);
  assert.match(app, /出題内容と誤答した問題をサマリにまとめ、この単元の学習記録として保存します/);
  assert.match(app, /正答数 × 10を目安に理解度を更新します/);
  assert.doesNotMatch(app, /参考リンク/);
});

test('study log content is read-only while the learner memo remains editable', () => {
  assert.match(app, /id="study-log-date-filter"/);
  assert.match(app, /date-input-placeholder/);
  assert.match(app, /placeholder = '日付を選択'/);
  assert.match(app, /id="clear-study-log-date"/);
  assert.match(app, /id="study-log-user-note"/);
  assert.match(app, /data-save-study-log-note/);
  assert.match(app, /updateStudyLogNote/);
  assert.match(app, /data-related-unit-id/);
  assert.doesNotMatch(app, /log\.mastery_note|理解度メモ/);
  assert.match(app, /log\.id === Number\(selectedId\)/);
  assert.match(app, /onClick=\{\(\) => onSelect\(log\.id\)\}/);
  assert.match(app, /id="back-to-study-logs"/);
  assert.match(app, /\{selected\s*\? <div className="study-log-detail-screen[^\"]*"/);
});

test('every date input uses the shared empty-state guidance', () => {
  assert.match(app, /function DateInput/);
  assert.match(app, /date-input-shell\$\{normalizedValue \? '' : ' is-empty'\}/);
  assert.match(app, /<DateInput name="last_reviewed_at"/);
  assert.match(app, /<DateInput wrapperClassName="date-input-control"/);
  assert.match(app, /date-input-shell/);
});

test('detail screens support a left-edge swipe back gesture', () => {
  assert.match(app, /function useEdgeSwipeBack/);
  assert.match(app, /touch\.clientX <= 64/);
  assert.match(app, /x >= 48 && x > y \* 1\.05/);
  assert.match(app, /onTouchMove: event =>/);
  assert.match(app, /data-edge-swipe-back=\{edgeSwipeEnabled/);
  assert.match(css, /\.edge-swipe-back\s*\{[^}]*touch-action:pan-y/);
});

test('storage status appears only in settings, not in a global header', () => {
  assert.doesNotMatch(app, /className="topbar"|local-badge|data-active-store/);
  assert.match(app, /現在の読み書き先:/);
  assert.match(app, /className=\{`connection-badge/);
});

test('library level filter combines with search without mutating entries', () => {
  assert.match(app, /id="forgetting-level-filter"/);
  assert.match(app, /<option value="all">すべて<\/option>/);
  assert.match(app, /Number\(entry\.forgetting_level \|\| 1\) === Number\(levelFilter\)/);
  assert.match(app, /levelFilters, setLevelFilters/);
  assert.doesNotMatch(app, /onLevelFilter[^\n]+api\.save/);
});

test('all primary views share one page width container', () => {
  for (const view of ['summary-view', 'workspace', 'curriculum-view', 'curriculum-detail-view', 'study-log-view', 'settings-view']) {
    assert.match(app, new RegExp(`${view}[^"\\}]*page-container|${view} page-container`));
  }
  assert.match(css, /\.page-container\s*\{[^}]*max-width:1160px/);
});

test('Ctrl+F integration remains connected to the renderer', () => {
  assert.match(app, /EnglishShelfShortcuts\.shouldFocusSearch/);
  assert.match(app, /searchRef\.current\?\.focus/);
  assert.match(app, /searchRef\.current\?\.select/);
});

test('Electron menu remains removed', () => {
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  assert.match(main, /Menu\.setApplicationMenu\(null\)/);
  assert.match(main, /autoHideMenuBar:\s*true/);
  assert.match(main, /dist', 'renderer', 'index\.html'/);
});
