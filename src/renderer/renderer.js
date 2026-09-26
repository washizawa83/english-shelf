const configs = {
  words: { singular: '単語', heading: '単語一覧', template: 'word-fields', primary: 'vocabulary', secondary: 'meaning', detail: 'example' },
  sentences: { singular: '英文・文法', heading: '英文・文法一覧', template: 'sentence-fields', primary: 'title', secondary: 'meaning', detail: 'similar_sentences' }
};
let kind = 'words';
let editingId = null;
let searchTimer;
const form = document.querySelector('#entry-form');
const list = document.querySelector('#entry-list');
const status = document.querySelector('#status');
const cancel = document.querySelector('#cancel-edit');
const entryDialog = document.querySelector('#entry-dialog');
const summaryView = document.querySelector('#summary-view');

function setForm(entry = null) {
  const config = configs[kind];
  editingId = entry?.id ?? null;
  form.innerHTML = document.querySelector(`#${config.template}`).innerHTML + `<button class="save-button" type="submit">${editingId ? '変更を保存' : `${config.singular}を保存`}</button>`;
  if (!editingId) form.querySelector('.forgetting-level-field')?.remove();
  if (entry) Object.entries(entry).forEach(([key, value]) => { const field = form.elements[key]; if (field) field.value = value; });
  document.querySelector('#form-label').textContent = editingId ? `EDIT ${kind.toUpperCase()}` : `NEW ${kind.slice(0, -1).toUpperCase()}`;
  document.querySelector('#form-title').textContent = editingId ? `${config.singular}を編集` : `${config.singular}を追加`;
}

function openEntryDialog(entry = null) {
  setForm(entry);
  entryDialog.showModal();
}

function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text || ''; return div.innerHTML; }
async function refresh() {
  const entries = await window.studyApi.list(kind, document.querySelector('#search').value);
  status.textContent = `${entries.length} 件`;
  const config = configs[kind];
  list.innerHTML = entries.length ? entries.map(entry => `<button class="entry-card" data-id="${entry.id}"><strong>${escapeHtml(entry[config.primary])}</strong><span>${escapeHtml(entry[config.secondary])}</span>${entry[config.detail] ? `<small>${escapeHtml(entry[config.detail])}</small>` : ''}<em>編集する →</em></button>`).join('') : `<div class="empty">まだ${config.singular}がありません。左のフォームから追加できます。</div>`;
}

function hideViews() {
  summaryView.hidden = true;
  document.querySelector('#library-workspace').hidden = true;
  document.querySelector('#curriculum-view').hidden = true;
  document.querySelector('#curriculum-detail-view').hidden = true;
  document.querySelector('#study-log-view').hidden = true;
}

async function showSummary() {
  hideViews();
  summaryView.hidden = false;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.kind === 'summary'));
  const [words, sentences, units, logs] = await Promise.all([
    window.studyApi.list('words', ''),
    window.studyApi.list('sentences', ''),
    window.studyApi.listCurriculum(),
    window.studyApi.listStudyLogs()
  ]);
  studyLogs = logs;
  const average = units.length ? Math.round(units.reduce((sum, unit) => sum + (Number(unit.mastery_percent) || 0), 0) / units.length) : 0;
  const started = units.filter(unit => unit.status !== '未着手' || Number(unit.mastery_percent) > 0).length;
  const completed = units.filter(unit => Number(unit.mastery_percent) === 100).length;
  document.querySelector('#summary-word-count').textContent = words.length;
  document.querySelector('#summary-sentence-count').textContent = sentences.length;
  document.querySelector('#summary-unit-count').textContent = units.length;
  document.querySelector('#summary-mastery-average').textContent = `${average}%`;
  document.querySelector('#summary-started-count').textContent = started;
  document.querySelector('#summary-completed-count').textContent = completed;
  document.querySelector('#summary-progress-label').textContent = `${average}%`;
  document.querySelector('#summary-mastery-bar').style.width = `${average}%`;
  document.querySelector('#summary-progress-started').textContent = started;
  document.querySelector('#summary-progress-completed').textContent = completed;
  document.querySelector('#summary-progress-total').textContent = units.length;
  renderForgettingDistribution(words, sentences);
  renderStudyActivity();
}

function forgettingLevelCounts(entries) {
  const counts = Array(8).fill(0);
  for (const entry of entries) {
    const raw = Number(entry.forgetting_level);
    const level = Number.isInteger(raw) && raw >= 1 && raw <= 8 ? raw : 1;
    counts[level - 1] += 1;
  }
  return counts;
}

function renderForgettingDistribution(words, sentences) {
  const wordCounts = forgettingLevelCounts(words);
  const sentenceCounts = forgettingLevelCounts(sentences);
  const maximum = Math.max(1, ...wordCounts, ...sentenceCounts);
  document.querySelector('#forgetting-distribution-chart').innerHTML = wordCounts.map((wordCount, index) => {
    const sentenceCount = sentenceCounts[index];
    const level = index + 1;
    return `<div class="level-group"><div class="bar-pair"><div class="bar-column"><span>${wordCount}</span><i class="distribution-bar word-bar" style="height:${(wordCount / maximum) * 100}%" aria-label="レベル${level} 単語 ${wordCount}件"></i></div><div class="bar-column"><span>${sentenceCount}</span><i class="distribution-bar sentence-bar" style="height:${(sentenceCount / maximum) * 100}%" aria-label="レベル${level} 英文・文法 ${sentenceCount}件"></i></div></div><strong>Lv.${level}</strong></div>`;
  }).join('');
}

function showLibrary(nextKind) {
  kind = nextKind;
  hideViews();
  document.querySelector('#library-workspace').hidden = false;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.kind === kind));
  document.querySelector('#list-title').textContent = configs[kind].heading;
  document.querySelector('#add-entry').textContent = `${configs[kind].singular}を追加`;
  document.querySelector('#search').value = '';
  refresh();
}

document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.kind === 'summary') {
    showSummary();
    return;
  }
  if (button.dataset.kind === 'study-logs') {
    hideViews();
    document.querySelector('#study-log-view').hidden = false;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button));
    refreshStudyLogs();
    return;
  }
  if (button.dataset.kind === 'curriculum') {
    hideViews();
    document.querySelector('#curriculum-view').hidden = false;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button));
    refreshCurriculum();
    return;
  }
  showLibrary(button.dataset.kind);
}));
form.addEventListener('submit', async event => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(form));
  const payload = editingId ? { ...data, id: editingId } : { ...data, forgetting_level: 1 };
  try { await window.studyApi.save(kind, payload); entryDialog.close(); await refresh(); status.textContent = '保存しました。'; } catch (error) { status.textContent = `保存できませんでした: ${error.message}`; }
});
list.addEventListener('click', async event => { const card = event.target.closest('.entry-card'); if (card) openEntryDialog(await window.studyApi.get(kind, Number(card.dataset.id))); });
cancel.addEventListener('click', () => entryDialog.close());
document.querySelector('#add-entry').addEventListener('click', () => openEntryDialog());
document.querySelector('#search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(refresh, 180); });
const dialog = document.querySelector('#review-dialog');
const reviewContent = document.querySelector('#review-content');
document.addEventListener('keydown', event => {
  if (!window.EnglishShelfShortcuts.shouldFocusSearch(event)) return;
  event.preventDefault();
  if (dialog.open) dialog.close();
  if (entryDialog.open) entryDialog.close();
  if (!summaryView.hidden || !document.querySelector('#curriculum-view').hidden || !document.querySelector('#curriculum-detail-view').hidden || !document.querySelector('#study-log-view').hidden) showLibrary(kind);
  const search = document.querySelector('#search');
  search.focus();
  search.select();
});
async function startReview() {
  const [words, sentences] = await Promise.all(['words', 'sentences'].map(type => window.studyApi.due(type)));
  const queue = [...words.map(entry => ({ type: 'words', entry })), ...sentences.map(entry => ({ type: 'sentences', entry }))];
  dialog.showModal();
  const show = () => {
    if (!queue.length) { reviewContent.innerHTML = '<h2>復習完了</h2><p>今の復習対象はありません。</p><button class="save-button" id="close-review">閉じる</button>'; document.querySelector('#close-review').onclick = () => { dialog.close(); refresh(); }; return; }
    const current = queue[0], config = configs[current.type], entry = current.entry;
    reviewContent.innerHTML = `<button class="text-button" id="close-review">閉じる</button><p class="eyebrow">${config.singular} / レベル ${entry.forgetting_level || 1}</p><h2>${escapeHtml(entry[config.primary])}</h2><button id="show-answer" class="answer-button">答えを表示</button>`;
    document.querySelector('#close-review').onclick = () => dialog.close();
    document.querySelector('#show-answer').onclick = () => { reviewContent.innerHTML = `<p class="eyebrow">ANSWER</p><h2>${escapeHtml(entry[config.primary])}</h2><p class="review-answer">${escapeHtml(entry[config.secondary])}</p>${entry[config.detail] ? `<p>${escapeHtml(entry[config.detail])}</p>` : ''}<p class="review-prompt">回答結果を選んでください</p><div class="review-actions"><button data-result="easy">ヒントなしで答えられた</button><button data-result="normal">ヒントありで答えられた</button><button data-result="hard">分からなかった</button></div>`; reviewContent.querySelectorAll('[data-result]').forEach(button => button.onclick = async () => { await window.studyApi.review(current.type, entry.id, button.dataset.result); queue.shift(); show(); }); };
  }; show();
}
document.querySelector('#start-review').addEventListener('click', startReview);

const curriculumList = document.querySelector('#curriculum-list');
const curriculumStatus = document.querySelector('#curriculum-status');
const curriculumDetailView = document.querySelector('#curriculum-detail-view');
const curriculumDetail = document.querySelector('#curriculum-detail');
let curriculumUnits = [];
let studyLogs = [];
let selectedStudyLogDate = '';

function formatRecordedAt(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : value;
}

function formatDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function renderStudyActivity() {
  const counts = new Map();
  for (const log of studyLogs) {
    const key = formatDateKey(log.recorded_at);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (52 * 7 + start.getDay()));
  const days = [];
  for (let offset = 0; offset < 53 * 7; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = formatDateKey(date);
    const count = counts.get(key) || 0;
    const future = date > today;
    days.push(`<button type="button" class="activity-day level-${Math.min(4, count)}${selectedStudyLogDate === key ? ' selected' : ''}" data-filter-date="${key}" title="${escapeHtml(date.toLocaleDateString('ja-JP'))}: ${count}件" aria-label="${escapeHtml(date.toLocaleDateString('ja-JP'))} ${count}件"${future ? ' disabled' : ''}></button>`);
  }
  document.querySelector('#study-activity-grid').innerHTML = days.join('');
  const dateInput = document.querySelector('#study-log-date-filter');
  dateInput.max = formatDateKey(today);
  dateInput.value = selectedStudyLogDate;
  document.querySelector('#clear-study-log-date').hidden = !selectedStudyLogDate;
}

function renderStudyLogList(selectedId = null) {
  const filtered = selectedStudyLogDate
    ? studyLogs.filter(log => formatDateKey(log.recorded_at) === selectedStudyLogDate)
    : studyLogs;
  document.querySelector('#study-log-count').textContent = selectedStudyLogDate ? `${selectedStudyLogDate} · ${filtered.length} 件` : `${filtered.length} 件`;
  const logList = document.querySelector('#study-log-list');
  logList.innerHTML = filtered.length
    ? filtered.map(log => `<button class="study-log-card" data-study-log-id="${log.id}"><time>${escapeHtml(formatRecordedAt(log.recorded_at))}</time><strong>${escapeHtml(log.title)}</strong><span>${escapeHtml(log.curriculum_unit_title || '関連単元なし')}</span></button>`).join('')
    : `<div class="empty">${selectedStudyLogDate ? 'この日の学習記録はありません。' : '学習記録はまだありません。Codexに「今の話を記録して」と伝えると追加できます。'}</div>`;
  const selected = selectedId ? filtered.find(log => log.id === Number(selectedId)) : filtered[0];
  if (selected) renderStudyLogDetail(selected);
  else document.querySelector('#study-log-detail').innerHTML = '<div class="empty">この日の学習記録はありません。</div>';
}

async function refreshStudyLogs(selectedId = null) {
  studyLogs = await window.studyApi.listStudyLogs();
  renderStudyActivity();
  renderStudyLogList(selectedId);
}

function renderStudyLogDetail(log) {
  const relatedUnit = log.curriculum_unit_id
    ? `<button class="related-unit-link" data-related-unit-id="${log.curriculum_unit_id}">${escapeHtml(log.curriculum_unit_title)}を見る →</button>`
    : '<span class="detail-empty">関連単元なし</span>';
  const detail = document.querySelector('#study-log-detail');
  detail.innerHTML = `<article class="study-log-detail"><p class="eyebrow">${escapeHtml(formatRecordedAt(log.recorded_at))}</p><h2>${escapeHtml(log.title)}</h2><section><h3>学習したこと</h3><p>${escapeHtml(log.summary)}</p></section><section class="study-log-note"><h3>メモ</h3><textarea id="study-log-user-note" rows="5" aria-label="学習記録のメモ" placeholder="自分用のメモを入力できます。">${escapeHtml(log.user_note || '')}</textarea><div class="study-log-note-actions"><button type="button" class="save-button" data-save-study-log-note>メモを保存</button><span class="status" data-study-log-note-status></span></div></section><section><h3>関連カリキュラム</h3>${relatedUnit}</section></article>`;
  detail.querySelector('[data-save-study-log-note]').onclick = async () => {
    const status = detail.querySelector('[data-study-log-note-status]');
    try {
      const updated = await window.studyApi.updateStudyLogNote(log.id, detail.querySelector('#study-log-user-note').value);
      const index = studyLogs.findIndex(item => item.id === log.id);
      if (index >= 0) studyLogs[index] = updated;
      detail.querySelector('#study-log-user-note').value = updated.user_note || '';
      status.textContent = '保存しました。';
    } catch (error) {
      status.textContent = `保存できませんでした: ${error.message}`;
    }
  };
}

async function showStudyLogView(logId, preserveDate = false) {
  if (!preserveDate) selectedStudyLogDate = '';
  hideViews();
  document.querySelector('#study-log-view').hidden = false;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.kind === 'study-logs'));
  await refreshStudyLogs(logId);
}

async function refreshCurriculum() {
  const units = await window.studyApi.listCurriculum();
  curriculumUnits = units;
  curriculumStatus.textContent = `${units.length} 単元`;
  if (!units.length) {
    curriculumList.innerHTML = '<div class="empty">まだ単元が登録されていません。</div>';
    return;
  }
  curriculumList.innerHTML = units.map((unit, index) => {
    const mastery = Math.max(0, Math.min(100, Number(unit.mastery_percent) || 0));
    const relations = unit.grammar_items.length
      ? unit.grammar_items.map(item => `<div class="relation-row"><span>${escapeHtml(item.title)}</span><button data-action="open" data-grammar-id="${item.id}">開く</button></div>`).join('')
      : '<small>関連する英文・文法はまだありません。</small>';
    return `<article class="curriculum-card" data-unit-id="${unit.id}" role="button" tabindex="0"><div class="curriculum-card-head"><div><span class="order-badge">UNIT ${index + 1}</span><h3>${escapeHtml(unit.title)}</h3></div><span class="mastery-badge">理解度 ${mastery}%</span></div><div class="mastery-track" aria-label="理解度 ${mastery}%"><span style="width:${mastery}%"></span></div><p class="curriculum-objective">${escapeHtml(unit.learning_objective) || '学習目標は未設定です。'}</p><div class="relations"><strong>関連する英文・文法</strong>${relations}</div><span class="detail-link">詳しく学ぶ →</span></article>`;
  }).join('');
}

function showCurriculumDetail(unitId) {
  const unit = curriculumUnits.find(item => item.id === Number(unitId));
  if (!unit) return;
  const mastery = Math.max(0, Math.min(100, Number(unit.mastery_percent) || 0));
  const details = unit.details || {};
  const rules = details.rules?.length
    ? `<ul>${details.rules.map(rule => `<li>${escapeHtml(rule)}</li>`).join('')}</ul>`
    : '<p class="detail-empty">この単元のルールはまだ登録されていません。</p>';
  const examples = details.examples?.length
    ? `<div class="example-list">${details.examples.map((item, index) => `<div class="example-item"><span>${index + 1}</span><div><strong>${escapeHtml(item.english)}</strong><p>${escapeHtml(item.japanese)}</p></div></div>`).join('')}</div>`
    : '<p class="detail-empty">例文はまだ登録されていません。</p>';
  const practice = details.practice?.length
    ? `<div class="practice-list">${details.practice.map(item => {
        const prompt = item.question || '';
        const hint = item.hint || '';
        const answer = item.answer || '';
        return `<div class="practice-item"><p>${escapeHtml(prompt)}</p>${hint ? `<details class="hint-details"><summary>ヒント</summary><p>${escapeHtml(hint)}</p></details>` : ''}${answer ? `<details class="answer-details"><summary>答えを見る</summary><p>${escapeHtml(answer)}</p></details>` : ''}</div>`;
      }).join('')}</div>`
    : '<p class="detail-empty">ミニ練習はまだ登録されていません。</p>';
  const related = unit.grammar_items.length
    ? `<div class="related-notes">${unit.grammar_items.map(item => `<button data-detail-grammar-id="${item.id}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.meaning)}</span></button>`).join('')}</div>`
    : '<p class="detail-empty">関連する英文・文法メモは未登録です。</p>';
  const unitLogs = unit.study_logs?.length
    ? `<div class="unit-study-log-list">${unit.study_logs.map(log => `<button data-detail-log-id="${log.id}"><time>${escapeHtml(formatRecordedAt(log.recorded_at))}</time><strong>${escapeHtml(log.title)}</strong></button>`).join('')}</div>`
    : '<p class="detail-empty">この単元に関連する学習記録はありません。</p>';
  curriculumDetail.innerHTML = `<header class="detail-header"><div><p class="eyebrow">UNIT ${unit.sort_order}</p><h2>${escapeHtml(unit.title)}</h2></div><span class="mastery-badge">理解度 ${mastery}%</span></header><div class="detail-mastery"><div class="mastery-track" aria-label="理解度 ${mastery}%"><span style="width:${mastery}%"></span></div></div><section><h3><span>01</span>この単元でできるようになること</h3><p>${escapeHtml(unit.learning_objective) || '学習目標は未設定です。'}</p></section><section><h3><span>02</span>まず知ること</h3><p>${escapeHtml(details.basics) || '基礎説明はまだ登録されていません。'}</p></section><section><h3><span>03</span>形・ルール</h3>${rules}</section><section><h3><span>04</span>例文</h3>${examples}</section><section><h3><span>05</span>ミニ練習</h3>${practice}</section><section><h3><span>06</span>仕上げ</h3><div class="finish-status"><span>現在の理解度</span><strong>${mastery}%</strong></div><div class="finish-guide"><p>AIに「この単元の仕上げを始めたい」と伝えてください。</p><ol><li>AIがこの単元を参照し、10問を1問ずつ出題します。</li><li>回答ごとに正誤と短い解説を伝えます。</li><li>最後に結果と苦手ポイントをまとめ、正答数 × 10を目安に理解度を更新します。</li></ol></div></section><section><h3><span>07</span>関連する英文・文法メモ</h3>${related}<div class="unit-study-logs"><h4>この単元の学習記録</h4>${unitLogs}</div></section>`;
  document.querySelector('#curriculum-view').hidden = true;
  curriculumDetailView.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCurriculumList() {
  curriculumDetailView.hidden = true;
  document.querySelector('#curriculum-view').hidden = false;
}

curriculumList.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    const unitCard = event.target.closest('[data-unit-id]');
    if (unitCard) showCurriculumDetail(Number(unitCard.dataset.unitId));
    return;
  }
  if (button.tagName === 'SELECT') return;
  const action = button.dataset.action;
  if (action === 'open') { const entry = await window.studyApi.get('sentences', Number(button.dataset.grammarId)); showLibrary('sentences'); openEntryDialog(entry); }
});
curriculumList.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.curriculum-card')) {
    event.preventDefault();
    showCurriculumDetail(Number(event.target.dataset.unitId));
  }
});
document.querySelector('#back-to-curriculum').addEventListener('click', showCurriculumList);
curriculumDetail.addEventListener('click', async event => {
  const log = event.target.closest('[data-detail-log-id]');
  if (log) {
    await showStudyLogView(Number(log.dataset.detailLogId));
    return;
  }
  const note = event.target.closest('[data-detail-grammar-id]');
  if (!note) return;
  const entry = await window.studyApi.get('sentences', Number(note.dataset.detailGrammarId));
  showLibrary('sentences');
  openEntryDialog(entry);
});
document.querySelector('#study-log-list').addEventListener('click', event => {
  const card = event.target.closest('[data-study-log-id]');
  if (card) renderStudyLogDetail(studyLogs.find(log => log.id === Number(card.dataset.studyLogId)));
});
document.querySelector('#study-activity-grid').addEventListener('click', event => {
  const day = event.target.closest('[data-filter-date]');
  if (!day || day.disabled) return;
  selectedStudyLogDate = day.dataset.filterDate;
  renderStudyActivity();
  showStudyLogView(null, true);
});
document.querySelector('#study-log-date-filter').addEventListener('change', event => {
  selectedStudyLogDate = event.target.value;
  renderStudyActivity();
  renderStudyLogList();
});
document.querySelector('#clear-study-log-date').addEventListener('click', () => {
  selectedStudyLogDate = '';
  renderStudyActivity();
  renderStudyLogList();
});
document.querySelector('#study-log-detail').addEventListener('click', async event => {
  const unit = event.target.closest('[data-related-unit-id]');
  if (!unit) return;
  await refreshCurriculum();
  document.querySelector('#study-log-view').hidden = true;
  document.querySelector('#curriculum-view').hidden = false;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.kind === 'curriculum'));
  showCurriculumDetail(Number(unit.dataset.relatedUnitId));
});

showSummary();
