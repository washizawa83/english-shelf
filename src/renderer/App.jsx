import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, BookText, Check, ChevronLeft, Copy, Database, Eye, EyeOff, GraduationCap, LayoutDashboard, NotebookPen, Pencil, Search, Settings, ShieldCheck, Sparkles, TextCursorInput } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import webApi from './web-api';

const api = window.studyApi || webApi;
const configs = {
  words: { singular: '単語', heading: '単語一覧', primary: 'vocabulary', secondary: 'meaning', detail: 'example' },
  sentences: { singular: '英文', heading: '英文一覧', primary: 'title', secondary: 'meaning', detail: 'similar_sentences' }
};
const tabs = [
  { id: 'summary', label: 'サマリ', Icon: LayoutDashboard },
  { id: 'words', label: '単語', Icon: TextCursorInput },
  { id: 'sentences', label: '英文', Icon: BookText },
  { id: 'curriculum', label: 'カリキュラム', Icon: GraduationCap },
  { id: 'study-logs', label: '学習記録', Icon: NotebookPen },
  { id: 'settings', label: '設定', Icon: Settings }
];

function formatRecordedAt(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value;
}

function formatDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function forgettingLevelCounts(entries) {
  const counts = Array(8).fill(0);
  entries.forEach(entry => {
    const raw = Number(entry.forgetting_level);
    const level = Number.isInteger(raw) && raw >= 1 && raw <= 8 ? raw : 1;
    counts[level - 1] += 1;
  });
  return counts;
}

function splitInflections(value) {
  const parts = String(value || '').split(/\s*(?:\/|／|,|、|\n)\s*/).filter(Boolean);
  return parts.length ? parts : ['未登録'];
}

function formatReviewDate(value) {
  if (!value) return '未復習';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ja-JP').format(date) : value;
}

function DateInput({ value = '', placeholder = '日付を選択', wrapperClassName = '', children, ...props }) {
  const normalizedValue = value || '';
  return <span className={`date-input-shell${normalizedValue ? '' : ' empty'}${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
    <Input type="date" value={normalizedValue} {...props} />
    {!normalizedValue && <span className="date-input-placeholder" aria-hidden="true">{placeholder}</span>}
    {children}
  </span>;
}

function ActivityGraph({ logs, selectedDate, onSelect }) {
  const days = useMemo(() => {
    const counts = new Map();
    logs.forEach(log => { const key = formatDateKey(log.recorded_at); counts.set(key, (counts.get(key) || 0) + 1); });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - (52 * 7 + start.getDay()));
    return Array.from({ length: 53 * 7 }, (_, offset) => {
      const date = new Date(start); date.setDate(start.getDate() + offset);
      const key = formatDateKey(date);
      return { key, count: counts.get(key) || 0, future: date > today, label: date.toLocaleDateString('ja-JP') };
    });
  }, [logs]);
  return <section className="activity-panel">
    <div className="activity-heading"><div><p className="eyebrow">DAILY ACTIVITY</p><h2>学習の積み重ね</h2></div></div>
    <div id="study-activity-grid" className="activity-grid" aria-label="日ごとの学習記録数">
      {days.map(day => <button key={day.key} type="button" className={`activity-day level-${Math.min(4, day.count)}${selectedDate === day.key ? ' selected' : ''}`} data-filter-date={day.key} title={`${day.label}: ${day.count}件`} aria-label={`${day.label} ${day.count}件`} disabled={day.future} onClick={() => onSelect(day.key)} />)}
    </div>
    <div className="activity-legend"><span>少ない</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className={`activity-day level-${level}`} />)}<span>多い</span></div>
  </section>;
}

function Summary({ hidden, words, sentences, units, logs, loadError, selectedDate, onSelectDate, onReview }) {
  const average = units.length ? Math.round(units.reduce((sum, unit) => sum + (Number(unit.mastery_percent) || 0), 0) / units.length) : 0;
  const started = units.filter(unit => unit.status !== '未着手' || Number(unit.mastery_percent) > 0).length;
  const completed = units.filter(unit => Number(unit.mastery_percent) === 100).length;
  const wordCounts = forgettingLevelCounts(words), sentenceCounts = forgettingLevelCounts(sentences);
  const maximum = Math.max(1, ...wordCounts, ...sentenceCounts);
  const cards = [['単語', words.length, '登録済み', 'summary-word-count'], ['英文', sentences.length, '登録済み', 'summary-sentence-count'], ['カリキュラム', units.length, '単元', 'summary-unit-count'], ['平均理解度', `${average}%`, '全単元', 'summary-mastery-average'], ['学習開始済み', started, '単元', 'summary-started-count'], ['完了', completed, '理解度100%の単元', 'summary-completed-count']];
  return <section className="summary-view page-container" id="summary-view" hidden={hidden}>
    <div className="summary-hero"><p>積み重ねた内容と、次に復習するものをひと目で確認できます。</p><Button id="start-review" className="review-start" onClick={onReview}><Sparkles size={17} />復習をはじめる</Button></div>
    {loadError && <div className="migration-notice" role="alert"><Database size={18} /><div><strong>Supabaseデータを表示できません</strong><p>{loadError}</p></div></div>}
    <div className="summary-grid">{cards.map(([label, value, hint, id]) => <article className="summary-card" key={id}><span>{label}</span><strong id={id}>{value}</strong><small>{hint}</small></article>)}</div>
    <section className="summary-panel curriculum-progress-panel">
      <div className="summary-panel-heading"><div><p className="eyebrow">CURRICULUM PROGRESS</p><h2>カリキュラム進捗</h2></div><strong id="summary-progress-label">{average}%</strong></div>
      <div className="summary-progress-track" aria-label="カリキュラム平均理解度"><span id="summary-mastery-bar" style={{ width: `${average}%` }} /></div>
      <div className="summary-progress-caption"><span><b id="summary-progress-started">{started}</b> 開始済み</span><span><b id="summary-progress-completed">{completed}</b> 完了</span><span><b id="summary-progress-total">{units.length}</b> 全単元</span></div>
    </section>
    <section className="summary-panel forgetting-panel">
      <div className="summary-panel-heading"><div><p className="eyebrow">REVIEW LEVELS</p><h2>忘却レベルの分布</h2></div><div className="distribution-legend"><span><i className="word-swatch" />単語</span><span><i className="sentence-swatch" />英文</span></div></div>
      <div id="forgetting-distribution-chart" className="forgetting-chart" aria-label="単語と英文の忘却レベル分布">{wordCounts.map((wordCount, index) => <div className="level-group" key={index}><div className="bar-pair"><div className="bar-column"><span>{wordCount}</span><i className="distribution-bar word-bar" style={{ height: `${(wordCount / maximum) * 100}%` }} aria-label={`レベル${index + 1} 単語 ${wordCount}件`} /></div><div className="bar-column"><span>{sentenceCounts[index]}</span><i className="distribution-bar sentence-bar" style={{ height: `${(sentenceCounts[index] / maximum) * 100}%` }} aria-label={`レベル${index + 1} 英文 ${sentenceCounts[index]}件`} /></div></div><strong>Lv.{index + 1}</strong></div>)}</div>
    </section>
    <ActivityGraph logs={logs} selectedDate={selectedDate} onSelect={onSelectDate} />
  </section>;
}

function EntryFields({ kind, form, setForm, editing }) {
  const field = (name, value) => setForm(previous => ({ ...previous, [name]: value }));
  return <>
    {kind === 'words' ? <>
      <Label>単語<Input name="vocabulary" required placeholder="e.g. resilient" value={form.vocabulary || ''} onChange={e => field('vocabulary', e.target.value)} /></Label>
      <Label>変形<Textarea name="inflection" rows={2} placeholder="例: go / goes / went / gone" value={form.inflection || ''} onChange={e => field('inflection', e.target.value)} /><small className="field-help">複数の形は「 / 」で区切って入力できます。Notionの「変形」にそのまま保存されます。</small></Label>
      <Label>意味<Textarea name="meaning" rows={3} value={form.meaning || ''} onChange={e => field('meaning', e.target.value)} /></Label>
      <Label>例文<Textarea name="example" rows={4} value={form.example || ''} onChange={e => field('example', e.target.value)} /></Label>
    </> : <>
      <Label>英文<Textarea name="title" required rows={4} value={form.title || ''} onChange={e => field('title', e.target.value)} /></Label>
      <Label>意味<Textarea name="meaning" rows={3} value={form.meaning || ''} onChange={e => field('meaning', e.target.value)} /></Label>
      <Label>類似の英文<Textarea name="similar_sentences" rows={3} value={form.similar_sentences || ''} onChange={e => field('similar_sentences', e.target.value)} /></Label>
    </>}
    <div className="field-row"><Label>最終復習日<DateInput name="last_reviewed_at" aria-label="最終復習日" value={(form.last_reviewed_at || '').slice(0, 10)} onChange={e => field('last_reviewed_at', e.target.value)} /></Label>
      {editing ? <Label className="forgetting-level-field">忘却レベル<Select name="forgetting_level" value={String(form.forgetting_level || 1)} onValueChange={value => field('forgetting_level', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 8 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>レベル {i + 1}</SelectItem>)}</SelectContent></Select></Label>
        : <div className="default-level-note"><span>忘却レベル</span><strong>レベル 1</strong><small>新規項目はレベル1で登録され、復習結果に応じて自動更新されます。</small></div>}
    </div>
  </>;
}

function EntryDialog({ open, onOpenChange, kind, entry, onSaved }) {
  const [form, setForm] = useState({});
  const [status, setStatus] = useState('');
  useEffect(() => { if (open) { setForm(entry || {}); setStatus(''); } }, [open, entry]);
  const config = configs[kind], editing = Boolean(entry?.id);
  async function submit(event) {
    event.preventDefault();
    const payload = editing ? { ...form, id: entry.id } : { ...form, forgetting_level: 1 };
    try { await api.save(kind, payload); onOpenChange(false); onSaved(); } catch (error) { setStatus(`保存できませんでした: ${error.message}`); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent id="entry-dialog" aria-describedby="entry-dialog-description">
    <div className="dialog-heading"><div><p className="eyebrow" id="form-label">{editing ? `EDIT ${kind.toUpperCase()}` : `NEW ${kind.slice(0, -1).toUpperCase()}`}</p><DialogTitle id="form-title">{editing ? `${config.singular}を編集` : `${config.singular}を追加`}</DialogTitle><DialogDescription id="entry-dialog-description" className="sr-only">学習項目の内容を入力します。</DialogDescription></div></div>
    <form id="entry-form" onSubmit={submit}><EntryFields kind={kind} form={form} setForm={setForm} editing={editing} /><Button type="submit" className="save-button">{editing ? '変更を保存' : `${config.singular}を保存`}</Button>{status && <p className="form-error">{status}</p>}</form>
  </DialogContent></Dialog>;
}

function LibraryEntryCard({ kind, entry, onEdit }) {
  const [meaningVisible, setMeaningVisible] = useState(false);
  const word = kind === 'words', meaning = entry.meaning || '未登録';
  return <article className={`entry-card${word ? ' word-entry-card' : ' sentence-entry-card'}`} data-id={entry.id}>
    <div className="entry-card-head"><strong>{word ? entry.vocabulary : entry.title}</strong><span className="level-badge">忘却 Lv.{entry.forgetting_level || 1}</span></div>
    {word && <div className="entry-field"><b>変形</b><span className="inflection-list">{splitInflections(entry.inflection).map((form, index) => <span className="inflection-chip" key={`${entry.id}-${index}`}>{form}</span>)}</span></div>}
    <div className="entry-field meaning-field"><b>意味</b><span className="meaning-value-row"><span className="meaning-value-shell"><span className={`meaning-text${meaningVisible ? '' : ' concealed'}`} aria-hidden={!meaningVisible}>{meaning}</span><span className={`meaning-mask${meaningVisible ? ' concealed' : ''}`} aria-hidden="true">••••••</span></span><Button type="button" variant="ghost" size="icon" className="meaning-toggle" data-toggle-meaning aria-label={meaningVisible ? '意味を隠す' : '意味を表示'} title={meaningVisible ? '意味を隠す' : '意味を表示'} aria-expanded={meaningVisible} onClick={() => setMeaningVisible(value => !value)}>{meaningVisible ? <EyeOff size={17} /> : <Eye size={17} />}</Button></span></div>
    {word && <div className="entry-field"><b>例文</b><span>{entry.example || '未登録'}</span></div>}
    {!word && entry.similar_sentences && <small>{entry.similar_sentences}</small>}
    <div className="entry-card-footer"><span className="entry-review-date"><b>最終復習日</b> {formatReviewDate(entry.last_reviewed_at)}</span><span className="entry-card-actions"><Button type="button" variant="ghost" size="icon" className="entry-edit-button" data-edit-entry aria-label={`${word ? '単語' : '英文'}を編集`} title={`${word ? '単語' : '英文'}を編集`} onClick={() => onEdit(entry.id)}><Pencil size={17} /></Button></span></div>
  </article>;
}

function Library({ hidden, kind, entries, search, onSearch, levelFilter, onLevelFilter, status, onAdd, onEdit, searchRef }) {
  const config = configs[kind];
  const visibleEntries = levelFilter === 'all' ? entries : entries.filter(entry => Number(entry.forgetting_level || 1) === Number(levelFilter));
  return <section className="workspace page-container" id="library-workspace" hidden={hidden}><section className="list-panel library-list-panel">
    <div className="list-toolbar"><div className="library-tools"><Label className="search"><Search size={16} /><Input ref={searchRef} id="search" type="search" placeholder={`${config.singular}を検索`} value={search} onChange={e => onSearch(e.target.value)} /></Label><Label className="level-filter"><span>忘却レベル</span><select id="forgetting-level-filter" value={levelFilter} onChange={event => onLevelFilter(event.target.value)}><option value="all">すべて</option>{Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={String(index + 1)}>レベル {index + 1}</option>)}</select></Label><Button id="add-entry" type="button" onClick={onAdd}>{config.singular}を追加</Button></div></div>
    <div id="status" className="status">{status === '検索中…' ? status : `${visibleEntries.length} 件`}</div><div id="entry-list" className="entry-list">{visibleEntries.length ? visibleEntries.map(entry => <LibraryEntryCard kind={kind} entry={entry} onEdit={onEdit} key={entry.id} />) : <div className="empty">{search || levelFilter !== 'all' ? '条件に一致する項目はありません。' : `まだ${config.singular}がありません。「追加」から登録できます。`}</div>}</div>
  </section></section>;
}

function CurriculumList({ hidden, units, onOpenUnit, onOpenGrammar }) {
  return <section className="curriculum-view page-container" id="curriculum-view" hidden={hidden}><section className="list-panel"><div className="view-status-row"><span id="curriculum-status" className="status">{units.length} 単元</span></div><div id="curriculum-list" className="curriculum-list">{units.length ? units.map((unit, index) => {
    const mastery = Math.max(0, Math.min(100, Number(unit.mastery_percent) || 0));
    return <article className="curriculum-card" data-unit-id={unit.id} role="button" tabIndex={0} key={unit.id} onClick={() => onOpenUnit(unit.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenUnit(unit.id); } }}><div className="curriculum-card-head"><div><span className="order-badge">UNIT {index + 1}</span><h3>{unit.title}</h3></div><span className="mastery-badge">理解度 {mastery}%</span></div><div className="mastery-track" aria-label={`理解度 ${mastery}%`}><span style={{ width: `${mastery}%` }} /></div><p className="curriculum-objective">{unit.learning_objective || '学習目標は未設定です。'}</p><div className="relations"><strong>関連する英文</strong>{unit.grammar_items.length ? unit.grammar_items.map(item => <div className="relation-row" key={item.id}><span>{item.title}</span><Button variant="outline" size="sm" data-action="open" data-grammar-id={item.id} onClick={event => { event.stopPropagation(); onOpenGrammar(item.id); }}>開く</Button></div>) : <small>関連する英文はまだありません。</small>}</div><span className="detail-link">詳しく学ぶ →</span></article>;
  }) : <div className="empty">まだ単元が登録されていません。</div>}</div></section></section>;
}

function CurriculumDetail({ hidden, unit, onBack, onOpenGrammar, onOpenLog }) {
  if (!unit) return null;
  const mastery = Math.max(0, Math.min(100, Number(unit.mastery_percent) || 0)), details = unit.details || {};
  const Section = ({ number, title, children }) => <section><h3><span>{number}</span>{title}</h3>{children}</section>;
  return <section className="curriculum-detail-view page-container" id="curriculum-detail-view" hidden={hidden}><Button id="back-to-curriculum" variant="ghost" className="back-button" onClick={onBack}><ChevronLeft size={17} />カリキュラム一覧へ</Button><article id="curriculum-detail" className="curriculum-detail">
    <header className="detail-header"><div><p className="eyebrow">UNIT {unit.sort_order}</p><h2>{unit.title}</h2></div><span className="mastery-badge">理解度 {mastery}%</span></header><div className="detail-mastery"><div className="mastery-track" aria-label={`理解度 ${mastery}%`}><span style={{ width: `${mastery}%` }} /></div></div>
    <Section number="01" title="この単元でできるようになること"><p>{unit.learning_objective || '学習目標は未設定です。'}</p></Section>
    <Section number="02" title="まず知ること"><p>{details.basics || '基礎説明はまだ登録されていません。'}</p></Section>
    <Section number="03" title="形・ルール">{details.rules?.length ? <ul>{details.rules.map((rule, index) => <li key={index}>{rule}</li>)}</ul> : <p className="detail-empty">この単元のルールはまだ登録されていません。</p>}</Section>
    <Section number="04" title="例文">{details.examples?.length ? <div className="example-list">{details.examples.map((item, index) => <div className="example-item" key={index}><span>{index + 1}</span><div><strong>{item.english}</strong><p>{item.japanese}</p></div></div>)}</div> : <p className="detail-empty">例文はまだ登録されていません。</p>}</Section>
    <Section number="05" title="ミニ練習">{details.practice?.length ? <div className="practice-list">{details.practice.map((item, index) => <div className="practice-item" key={index}><p>{item.question || ''}</p>{item.hint && <details className="hint-details"><summary>ヒント</summary><p>{item.hint}</p></details>}{item.answer && <details className="answer-details"><summary>答えを見る</summary><p>{item.answer}</p></details>}</div>)}</div> : <p className="detail-empty">ミニ練習はまだ登録されていません。</p>}</Section>
    <Section number="06" title="仕上げ"><div className="finish-status"><span>現在の理解度</span><strong>{mastery}%</strong></div><div className="finish-guide"><p>AIに「この単元の仕上げを始めたい」と伝えてください。</p><ol><li>AIがこの単元を参照し、10問を1問ずつ出題します。</li><li>回答ごとに正誤と短い解説を伝えます。</li><li>最後に結果と苦手ポイントをまとめ、正答数 × 10を目安に理解度を更新します。</li></ol></div></Section>
    <Section number="07" title="関連する英文メモ">{unit.grammar_items.length ? <div className="related-notes">{unit.grammar_items.map(item => <Button variant="outline" key={item.id} data-detail-grammar-id={item.id} onClick={() => onOpenGrammar(item.id)}><strong>{item.title}</strong><span>{item.meaning}</span></Button>)}</div> : <p className="detail-empty">関連する英文メモは未登録です。</p>}<div className="unit-study-logs"><h4>この単元の学習記録</h4>{unit.study_logs?.length ? <div className="unit-study-log-list">{unit.study_logs.map(log => <Button variant="outline" key={log.id} data-detail-log-id={log.id} onClick={() => onOpenLog(log.id)}><time>{formatRecordedAt(log.recorded_at)}</time><strong>{log.title}</strong></Button>)}</div> : <p className="detail-empty">この単元に関連する学習記録はありません。</p>}</div></Section>
  </article></section>;
}

function StudyLogs({ hidden, logs, selectedDate, onDate, selectedId, onSelect, onBack, onOpenUnit, onUpdateNote }) {
  const filtered = selectedDate ? logs.filter(log => formatDateKey(log.recorded_at) === selectedDate) : logs;
  const selected = filtered.find(log => log.id === Number(selectedId)) || null;
  return <section className={`study-log-view page-container${selected ? ' detail-open' : ''}`} id="study-log-view" hidden={hidden}>{selected
    ? <div className="study-log-detail-screen"><Button id="back-to-study-logs" type="button" variant="ghost" className="back-button" onClick={onBack}><ChevronLeft size={17} />学習記録一覧へ</Button><section className="list-panel" id="study-log-detail"><StudyLogDetail log={selected} onOpenUnit={onOpenUnit} onUpdateNote={onUpdateNote} /></section></div>
    : <aside className="list-panel"><div className="panel-heading study-log-heading"><span id="study-log-count" className="status">{selectedDate ? `${selectedDate} · ${filtered.length} 件` : `${filtered.length} 件`}</span><div className="date-filter"><span className="date-filter-label">日付指定</span><DateInput wrapperClassName="date-input-control" id="study-log-date-filter" aria-label="学習記録を日付で絞り込む" max={formatDateKey(new Date())} value={selectedDate} onChange={event => onDate(event.target.value)}><Button id="clear-study-log-date" className="date-clear-inside" type="button" variant="ghost" size="icon" aria-label="日付選択を解除" hidden={!selectedDate} onClick={() => onDate('')}>×</Button></DateInput></div></div>
      <div id="study-log-list" className="study-log-list">{filtered.length ? filtered.map(log => <Button variant="outline" className="study-log-card" data-study-log-id={log.id} key={log.id} onClick={() => onSelect(log.id)}><time>{formatRecordedAt(log.recorded_at)}</time><strong>{log.title}</strong><span>{log.curriculum_unit_title || '関連単元なし'}</span></Button>) : <div className="empty">{selectedDate ? 'この日の学習記録はありません。' : '学習記録はまだありません。Codexに「今の話を記録して」と伝えると追加できます。'}</div>}</div></aside>}
  </section>;
}

function StudyLogDetail({ log, onOpenUnit, onUpdateNote }) {
  const [note, setNote] = useState(log.user_note || ''), [status, setStatus] = useState('');
  useEffect(() => { setNote(log.user_note || ''); setStatus(''); }, [log]);
  async function save() { try { const updated = await api.updateStudyLogNote(log.id, note); setNote(updated.user_note || ''); onUpdateNote(updated); setStatus('保存しました。'); } catch (error) { setStatus(`保存できませんでした: ${error.message}`); } }
  return <article className="study-log-detail"><p className="eyebrow">{formatRecordedAt(log.recorded_at)}</p><h2>{log.title}</h2><section><h3>学習したこと</h3><p>{log.summary}</p></section><section className="study-log-note"><h3>メモ</h3><Textarea id="study-log-user-note" rows={5} aria-label="学習記録のメモ" placeholder="自分用のメモを入力できます。" value={note} onChange={e => setNote(e.target.value)} /><div className="study-log-note-actions"><Button type="button" data-save-study-log-note onClick={save}>メモを保存</Button><span className="status" data-study-log-note-status>{status}</span></div></section><section><h3>関連カリキュラム</h3>{log.curriculum_unit_id ? <Button variant="outline" className="related-unit-link" data-related-unit-id={log.curriculum_unit_id} onClick={() => onOpenUnit(log.curriculum_unit_id)}>{log.curriculum_unit_title}を見る →</Button> : <span className="detail-empty">関連単元なし</span>}</section></article>;
}

function ReviewDialog({ open, onOpenChange, queue, setQueue, onFinish }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { if (open) setRevealed(false); }, [open, queue.length]);
  const current = queue[0], config = current ? configs[current.type] : null;
  async function answer(result) { await api.review(current.type, current.entry.id, result); setQueue(previous => previous.slice(1)); setRevealed(false); }
  return <Dialog open={open} onOpenChange={value => { onOpenChange(value); if (!value) onFinish(); }}><DialogContent id="review-dialog" className="review-dialog" aria-describedby="review-description"><div id="review-content">{!current ? <><p className="eyebrow">REVIEW COMPLETE</p><DialogTitle>復習完了</DialogTitle><DialogDescription id="review-description">今の復習対象はありません。</DialogDescription><DialogClose asChild><Button className="review-close">閉じる</Button></DialogClose></> : !revealed ? <><p className="eyebrow">{config.singular} / レベル {current.entry.forgetting_level || 1}</p><DialogTitle>{current.entry[config.primary]}</DialogTitle><DialogDescription id="review-description">答えを思い浮かべてから表示してください。</DialogDescription><Button id="show-answer" className="answer-button" onClick={() => setRevealed(true)}>答えを表示</Button></> : <><p className="eyebrow">ANSWER</p><DialogTitle>{current.entry[config.primary]}</DialogTitle><DialogDescription id="review-description" className="review-answer">{current.entry[config.secondary]}</DialogDescription>{current.entry[config.detail] && <p>{current.entry[config.detail]}</p>}<p className="review-prompt">回答結果を選んでください</p><div className="review-actions"><Button data-result="easy" onClick={() => answer('easy')}>ヒントなしで答えられた</Button><Button variant="secondary" data-result="normal" onClick={() => answer('normal')}>ヒントありで答えられた</Button><Button variant="destructive" data-result="hard" onClick={() => answer('hard')}>分からなかった</Button></div></>}</div></DialogContent></Dialog>;
}

function SupabaseSettings({ hidden, storeState, onStoreStateChange }) {
  const isWeb = api.platform === 'web';
  const [form, setForm] = useState({ url: '', publishableKey: '' });
  const [status, setStatus] = useState(''), [verified, setVerified] = useState(false), [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(null), [confirmOpen, setConfirmOpen] = useState(false), [confirmed, setConfirmed] = useState(false), [result, setResult] = useState(null);
  const [accessSetup, setAccessSetup] = useState(null), [accessVerified, setAccessVerified] = useState(false);
  const [accessStatus, setAccessStatus] = useState(''), [accessResult, setAccessResult] = useState(null);
  const [switchOpen, setSwitchOpen] = useState(false), [switchConfirmed, setSwitchConfirmed] = useState(false);
  useEffect(() => { Promise.all([api.getSupabaseSettings(), api.getDataStoreStatus()]).then(async ([settings, dataStore]) => { setForm(settings); onStoreStateChange(dataStore); if (isWeb && dataStore.activeStore !== 'supabase' && dataStore.diagnostics?.accessAuthorized === true) { setAccessStatus('保存済みの端末認証でSupabaseデータを確認しています…'); try { const checked = await api.verifySupabaseData(); setAccessVerified(true); setAccessResult(checked); setAccessStatus('Supabaseデータを確認できました。追加のSQL実行は不要です。'); } catch (error) { setAccessStatus(error.message); } } }).catch(error => { setStatus(error.message); setAccessStatus(error.message); }); }, [isWeb, onStoreStateChange]);
  const field = (name, value) => { setForm(previous => ({ ...previous, [name]: value })); setVerified(false); setSetup(null); setResult(null); };
  async function save() {
    setBusy(true); setStatus('');
    try { const saved = await api.saveSupabaseSettings(form); setForm(saved); setVerified(false); setSetup(null); setStatus('設定をこの端末に保存しました。'); }
    catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }
  async function checkConnection() {
    setBusy(true); setStatus('接続を確認しています…');
    try { const response = await api.checkSupabaseConnection(form); setVerified(true); setSetup(null); setStatus(response.message); }
    catch (error) { setVerified(false); setStatus(error.message); } finally { setBusy(false); }
  }
  async function prepare() {
    setBusy(true); setStatus('セットアップSQLを準備しています…');
    try { const next = await api.prepareSupabaseMigration(); setSetup(next); setStatus('SQLをSupabase DashboardのSQL Editorで一度だけ実行してください。'); }
    catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }
  async function copySql() {
    try { await navigator.clipboard.writeText(setup.setupSql); setStatus('セットアップSQLをコピーしました。'); }
    catch { setStatus('コピーできませんでした。SQL欄を選択してコピーしてください。'); }
  }
  async function runMigration() {
    setConfirmOpen(false); setBusy(true); setStatus('Supabaseへコピーし、内容を照合しています…');
    try { const migrated = await api.runSupabaseMigration(); setResult(migrated); setStatus('移行と内容照合が完了しました。既定の接続先はSQLiteのままです。'); }
    catch (error) { setStatus(error.message); } finally { setBusy(false); setConfirmed(false); }
  }
  async function prepareAccess() {
    setBusy(true); setStatus('Supabase利用SQLを準備しています…');
    try { const prepared = await api.prepareSupabaseAccess(); setAccessSetup(prepared); setAccessVerified(false); setAccessResult(null); setAccessStatus('端末認証SQLを実行後、下の確認ボタンを押してください。'); setStatus('SQLをSupabase DashboardのSQL Editorで一度だけ実行してください。'); }
    catch (error) { setStatus(error.message); setAccessStatus(error.message); } finally { setBusy(false); }
  }
  async function verifyAccess() {
    setBusy(true); setAccessResult(null); setAccessStatus(isWeb ? '端末認証とSupabaseデータを確認しています…' : 'SQLiteとSupabaseの全データを再照合しています…'); setStatus(isWeb ? 'Supabaseデータを確認しています…' : 'SQLiteとSupabaseの全データを再照合しています…');
    try { const checked = await api.verifySupabaseData(); setAccessVerified(true); setAccessResult(checked); onStoreStateChange(previous => ({ ...previous, migrationVerified: true })); const message = `確認完了（単語${checked.counts.words}件・英文${checked.counts.sentences}件・カリキュラム${checked.counts.curriculum_units}件・学習記録${checked.counts.study_logs}件）。`; setAccessStatus(message); setStatus(message); }
    catch (error) { setAccessVerified(false); setAccessStatus(`確認失敗: ${error.message}`); setStatus(error.message); } finally { setBusy(false); }
  }
  async function enableSupabase() {
    setSwitchOpen(false); setBusy(true); setStatus('切替前の最終照合を実行しています…');
    try { await api.enableSupabase(); onStoreStateChange({ activeStore: 'supabase', migrationVerified: true }); setStatus('読み書き先をSupabaseへ切り替えました。'); if (isWeb) window.location.reload(); }
    catch (error) { setStatus(`${error.message} 現在の読み書き先はSQLiteのままです。`); } finally { setBusy(false); setSwitchConfirmed(false); }
  }
  async function enableSqlite() {
    setBusy(true); setStatus('SQLiteへ戻しています…');
    try { await api.enableSqlite(); onStoreStateChange(previous => ({ ...previous, activeStore: 'sqlite' })); setStatus('読み書き先をSQLiteへ戻しました。Supabase上のコピーは削除されません。'); }
    catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }
  const countLabels = { words: '単語', sentences: '英文', curriculum_units: 'カリキュラム', curriculum_unit_grammar_items: '関連付け', study_logs: '学習記録' };
  return <section className="settings-view page-container" id="settings-view" hidden={hidden}>
    <header className="settings-heading"><p>現在の読み書き先: <strong>{storeState.activeStore === 'supabase' ? 'Supabase' : isWeb ? '未設定' : 'ローカルSQLite'}</strong></p><span className={`connection-badge${verified ? ' verified' : ''}`}>{storeState.activeStore === 'supabase' ? <><ShieldCheck size={15} />Supabaseを使用中</> : verified ? <><ShieldCheck size={15} />接続確認済み</> : <><Database size={15} />{isWeb ? '初期設定が必要' : 'SQLiteが既定'}</>}</span></header>
    <section className="settings-card"><div className="settings-card-heading"><h3>Data API</h3><p>保存するのはURLとPublishable Keyだけです。DBパスワード、Secret Key、Service Role Keyは受け付けません。</p></div>
      <form onSubmit={event => { event.preventDefault(); save(); }}>
        <Label>Supabase URL<Input id="supabase-url" type="url" placeholder="https://your-project.supabase.co" autoComplete="off" value={form.url} onChange={event => field('url', event.target.value)} /></Label>
        <Label>Supabase Publishable Key<Input id="supabase-publishable-key" type="password" placeholder="sb_publishable_..." autoComplete="off" value={form.publishableKey} onChange={event => field('publishableKey', event.target.value)} /></Label>
        <div className="settings-actions"><Button type="submit" disabled={busy}>設定を保存</Button><Button type="button" variant="outline" disabled={busy || !form.url || !form.publishableKey} onClick={checkConnection}>読み取り接続を確認</Button></div>
      </form><p className="settings-status" role="status">{status}</p>
    </section>
    {!isWeb && <section className="settings-card migration-card"><div className="settings-card-heading"><h3>SQLiteからSupabaseへ移行</h3><p>明示実行した場合だけ、ローカルSQLiteを残したままSupabaseへコピーします。移行後も接続先は自動で切り替わりません。</p></div>
      <div className="migration-notice"><ShieldCheck size={18} /><div><strong>管理キーはアプリに入力しません</strong><p>Publishable Keyではテーブルを作成できないため、一度限りの安全なセットアップSQLをDashboardで実行します。通常テーブルはRLS有効・匿名アクセス不可です。</p></div></div>
      <Button type="button" variant="outline" disabled={busy || !verified} onClick={prepare}>セットアップSQLを生成</Button>
      {setup && <div className="setup-sql"><div className="setup-sql-heading"><strong>Supabase SQL Editorで一度だけ実行</strong><Button type="button" variant="outline" size="sm" onClick={copySql}><Copy size={14} />SQLをコピー</Button></div><Textarea readOnly rows={10} value={setup.setupSql} aria-label="SupabaseセットアップSQL" /><div className="migration-counts">{Object.entries(setup.counts).map(([key, count]) => <span key={key}>{countLabels[key]} <b>{count}</b></span>)}</div><Button type="button" disabled={busy} onClick={() => setConfirmOpen(true)}>SQL実行済み・移行内容を確認</Button></div>}
      {result && <div className="migration-result"><Check size={18} /><div><strong>移行完了・内容一致</strong><p>{Object.entries(result.counts).map(([key, count]) => `${countLabels[key]} ${count}件`).join(' / ')}</p><small>照合ハッシュ: {result.remoteHash.slice(0, 16)}…</small></div></div>}
    </section>}
    <section className="settings-card use-supabase-card"><div className="settings-card-heading"><h3>{isWeb ? 'SupabaseをWeb版で使用する' : '読み書き先を切り替える'}</h3><p>{isWeb ? '端末専用のRLS利用SQLを実行し、Supabaseデータを確認してから有効化します。' : 'Supabase利用SQLを実行後、SQLiteとSupabaseを再照合してから明示的に切り替えます。失敗時はSQLiteを維持します。'}</p></div>
      {storeState.activeStore === 'supabase' ? <><div className="migration-result"><ShieldCheck size={18} /><div><strong>Supabaseを使用中</strong><p>新規追加・更新・復習・学習記録{isWeb ? '' : 'とMCP'}はSupabaseを読み書きします。</p></div></div>{!isWeb && <Button type="button" variant="outline" disabled={busy} onClick={enableSqlite}>SQLiteへ戻す</Button>}</> : <>
        <div className="migration-notice"><Database size={18} /><div><strong>{isWeb ? 'Supabaseを有効化するまでデータは表示されません' : '切替前はSQLiteを使用します'}</strong><p>{isWeb ? '接続確認とSupabaseデータ確認が完了するまで有効化できません。' : '接続確認と移行データ照合が完了するまで切替できません。切替後もSQLiteデータは削除されません。'}</p></div></div>
        <Button type="button" variant="outline" disabled={busy || !verified} onClick={prepareAccess}>Supabase利用SQLを生成</Button>
        {accessSetup && <div className="setup-sql"><div className="setup-sql-heading"><strong>Supabase SQL Editorで一度だけ実行</strong><Button type="button" variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(accessSetup.setupSql); setStatus('Supabase利用SQLをコピーしました。'); }}><Copy size={14} />利用SQLをコピー</Button></div><Textarea readOnly rows={10} value={accessSetup.setupSql} aria-label="Supabase利用SQL" /><Button type="button" variant="outline" disabled={busy} onClick={verifyAccess}>{busy ? '確認中…' : `SQL実行済み・${isWeb ? 'Supabaseデータを確認' : '移行データを再照合'}`}</Button></div>}
        {accessStatus && <div className={accessVerified ? 'migration-result' : 'migration-notice'} id="access-verification-status" role="status"><Database size={18} /><div><strong>{accessVerified ? 'Supabaseデータ確認済み' : '端末認証の確認状況'}</strong><p>{accessStatus}</p>{accessResult && <div className="migration-counts">{Object.entries(accessResult.counts).map(([key, count]) => <span key={key}>{countLabels[key]} <b>{count}</b></span>)}</div>}</div></div>}
        <Button type="button" disabled={busy || !verified || !accessVerified} onClick={() => setSwitchOpen(true)}>Supabaseを使用する</Button>
      </>}
    </section>
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent aria-describedby="migration-confirm-description"><p className="eyebrow">FINAL CONFIRMATION</p><DialogTitle>Supabaseへコピーしますか？</DialogTitle><DialogDescription id="migration-confirm-description">ローカルSQLiteは削除・上書きされません。Supabase側の空のEnglish Shelfテーブルへ全データをコピーし、件数・内容を照合します。</DialogDescription><Label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />ローカルデータが残り、既定接続先もSQLiteのままであることを確認しました</Label><div className="confirm-actions"><DialogClose asChild><Button variant="outline">キャンセル</Button></DialogClose><Button disabled={!confirmed || busy} onClick={runMigration}>コピーを開始</Button></div></DialogContent></Dialog>
    <Dialog open={switchOpen} onOpenChange={setSwitchOpen}><DialogContent aria-describedby="switch-confirm-description"><p className="eyebrow">CHANGE DATA STORE</p><DialogTitle>Supabaseを使用しますか？</DialogTitle><DialogDescription id="switch-confirm-description">{isWeb ? '有効化後は、新規追加・更新・復習結果・学習記録がSupabaseのデータを読み書きします。' : '切替後は、新規追加・更新・復習結果・学習記録・MCPがSupabaseのデータを読み書きします。切替直前にもう一度全データを照合し、不一致ならSQLiteを維持します。'}</DialogDescription><Label className="confirmation-check"><input type="checkbox" checked={switchConfirmed} onChange={event => setSwitchConfirmed(event.target.checked)} />以後の読み書き先がSupabaseになることを確認しました</Label><div className="confirm-actions"><DialogClose asChild><Button variant="outline">キャンセル</Button></DialogClose><Button disabled={!switchConfirmed || busy} onClick={enableSupabase}>{isWeb ? 'Supabaseを有効化する' : '照合してSupabaseへ切り替える'}</Button></div></DialogContent></Dialog>
  </section>;
}

export default function App() {
  const [view, setView] = useState(api.initialView || 'summary'), [kind, setKind] = useState('words');
  const [words, setWords] = useState([]), [sentences, setSentences] = useState([]), [units, setUnits] = useState([]), [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [entries, setEntries] = useState([]), [search, setSearch] = useState(''), [libraryStatus, setLibraryStatus] = useState('');
  const [levelFilters, setLevelFilters] = useState({ words: 'all', sentences: 'all' });
  const [entryOpen, setEntryOpen] = useState(false), [editingEntry, setEditingEntry] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null), [selectedDate, setSelectedDate] = useState(''), [selectedLogId, setSelectedLogId] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false), [reviewQueue, setReviewQueue] = useState([]);
  const [pullDistance, setPullDistance] = useState(0), [pullStatus, setPullStatus] = useState('idle');
  const [storeState, setStoreState] = useState({ activeStore: 'loading', migrationVerified: false });
  const searchRef = useRef(null), searchTimer = useRef(null), pullStart = useRef(null), pullDistanceRef = useRef(0);
  const refreshAll = useCallback(async () => { try { const state = await api.getDataStoreStatus(); setStoreState(state); if (api.platform === 'web' && state.activeStore !== 'supabase') throw new Error(state.needsReauthorization ? '端末認証を再設定してください。保存済みのURLとPublishable Keyは維持されています。' : '設定画面でSupabaseを有効化するとデータが表示されます。'); const [nextWords, nextSentences, nextUnits, nextLogs] = await Promise.all([api.list('words', ''), api.list('sentences', ''), api.listCurriculum(), api.listStudyLogs()]); setWords(nextWords); setSentences(nextSentences); setUnits(nextUnits); setLogs(nextLogs); setLoadError(''); } catch (error) { setLoadError(error.message); } }, []);
  const refreshLibrary = useCallback(async (nextKind = kind, query = search) => { const next = await api.list(nextKind, query); setEntries(next); setLibraryStatus(`${next.length} 件`); }, [kind, search]);
  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => { if (view !== 'words' && view !== 'sentences') return; clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => refreshLibrary(kind, search), 180); return () => clearTimeout(searchTimer.current); }, [view, kind, search, refreshLibrary]);
  useEffect(() => { const listener = event => { if (!window.EnglishShelfShortcuts.shouldFocusSearch(event)) return; event.preventDefault(); setEntryOpen(false); setReviewOpen(false); setView(kind); setTimeout(() => { searchRef.current?.focus(); searchRef.current?.select(); }); }; document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener); }, [kind]);

  function navigate(target) { if (target === 'words' || target === 'sentences') { setKind(target); setSearch(''); setView(target); } else { if (target === 'study-logs') setSelectedLogId(null); setView(target); } }
  async function editEntry(id, targetKind = kind) { const entry = await api.get(targetKind, Number(id)); setKind(targetKind); setView(targetKind); setEditingEntry(entry); setEntryOpen(true); }
  async function startReview() { const [dueWords, dueSentences] = await Promise.all(['words', 'sentences'].map(type => api.due(type))); setReviewQueue([...dueWords.map(entry => ({ type: 'words', entry })), ...dueSentences.map(entry => ({ type: 'sentences', entry }))]); setReviewOpen(true); }
  function openUnit(id) { setSelectedUnitId(Number(id)); setView('curriculum-detail'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function openLog(id) { setSelectedDate(''); setSelectedLogId(Number(id)); setView('study-logs'); }
  function selectActivityDate(date) { setSelectedDate(date); setSelectedLogId(null); setView('study-logs'); }
  function selectStudyLog(id) { setSelectedLogId(Number(id)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function closeStudyLog() { setSelectedLogId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function updateLog(updated) { setLogs(previous => previous.map(log => log.id === updated.id ? updated : log)); }
  function beginPull(event) { if (api.platform !== 'web' || window.innerWidth > 760 || window.scrollY > 0 || event.touches.length !== 1 || pullStatus === 'refreshing') return; pullStart.current = event.touches[0].clientY; pullDistanceRef.current = 0; }
  function movePull(event) { if (pullStart.current == null || event.touches.length !== 1) return; const distance = Math.min(96, Math.max(0, (event.touches[0].clientY - pullStart.current) * .55)); pullDistanceRef.current = distance; if (distance < 5) return; setPullStatus('pulling'); setPullDistance(distance); }
  async function finishPull() { if (pullStart.current == null) return; const distance = pullDistanceRef.current, shouldRefresh = distance >= 64; pullStart.current = null; pullDistanceRef.current = 0; if (!shouldRefresh) { if (distance >= 5) { setPullDistance(0); setPullStatus('idle'); } return; } setPullDistance(52); setPullStatus('refreshing'); const tasks = [refreshAll()]; if (view === 'words' || view === 'sentences') tasks.push(refreshLibrary(kind, search)); await Promise.allSettled(tasks); setPullStatus('done'); setPullDistance(0); setTimeout(() => setPullStatus('idle'), 900); }
  const selectedUnit = units.find(unit => unit.id === selectedUnitId);
  const activeTab = view === 'curriculum-detail' ? 'curriculum' : view;
  const storeBadge = storeState.activeStore === 'supabase' ? { label: 'Supabaseに保存', Icon: ShieldCheck, className: ' supabase' } : storeState.activeStore === 'sqlite' ? { label: 'この端末に保存', Icon: Check, className: '' } : { label: api.platform === 'web' ? '保存先が未設定' : '保存先を確認中', Icon: Database, className: ' pending' };
  const StoreBadgeIcon = storeBadge.Icon;
  return <>
    <div className={`pull-refresh ${pullStatus}`} style={{ '--pull-distance': `${pullDistance}px` }} role="status" aria-live="polite">{pullStatus === 'refreshing' ? '更新中…' : pullStatus === 'done' ? '更新しました' : pullDistance >= 64 ? '離して更新' : '引き下げて更新'}</div>
    <main className="app-shell" onTouchStart={beginPull} onTouchMove={movePull} onTouchEnd={finishPull} onTouchCancel={finishPull}><header className="topbar"><div className="brand"><span className="brand-mark"><BookOpen size={18} /></span><div><strong>English Shelf</strong><small>LOCAL STUDY DESK</small></div></div><span className={`local-badge${storeBadge.className}`} data-active-store={storeState.activeStore}><StoreBadgeIcon size={13} />{storeBadge.label}</span></header>
      <nav className="tabs" aria-label="メインナビゲーション">{tabs.map(({ id, label, Icon }) => <Button variant="ghost" className={`tab${activeTab === id ? ' active' : ''}`} data-kind={id} key={id} aria-label={label} title={label} onClick={() => navigate(id)}><Icon className="tab-icon" size={19} aria-hidden="true" /><span className="tab-label">{label}</span></Button>)}</nav>
      <Summary hidden={view !== 'summary'} words={words} sentences={sentences} units={units} logs={logs} loadError={loadError} selectedDate={selectedDate} onSelectDate={selectActivityDate} onReview={startReview} />
      <Library hidden={view !== 'words' && view !== 'sentences'} kind={kind} entries={entries} search={search} onSearch={value => { setSearch(value); setLibraryStatus('検索中…'); }} levelFilter={levelFilters[kind]} onLevelFilter={value => setLevelFilters(previous => ({ ...previous, [kind]: value }))} status={libraryStatus} onAdd={() => { setEditingEntry(null); setEntryOpen(true); }} onEdit={editEntry} searchRef={searchRef} />
      <CurriculumList hidden={view !== 'curriculum'} units={units} onOpenUnit={openUnit} onOpenGrammar={id => editEntry(id, 'sentences')} />
      <CurriculumDetail hidden={view !== 'curriculum-detail'} unit={selectedUnit} onBack={() => setView('curriculum')} onOpenGrammar={id => editEntry(id, 'sentences')} onOpenLog={openLog} />
      <StudyLogs hidden={view !== 'study-logs'} logs={logs} selectedDate={selectedDate} onDate={value => { setSelectedDate(value); setSelectedLogId(null); }} selectedId={selectedLogId} onSelect={selectStudyLog} onBack={closeStudyLog} onOpenUnit={openUnit} onUpdateNote={updateLog} />
      <SupabaseSettings hidden={view !== 'settings'} storeState={storeState} onStoreStateChange={setStoreState} />
    </main>
    <EntryDialog open={entryOpen} onOpenChange={setEntryOpen} kind={kind} entry={editingEntry} onSaved={async () => { await Promise.all([refreshLibrary(), refreshAll()]); setLibraryStatus('保存しました。'); }} />
    <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} queue={reviewQueue} setQueue={setReviewQueue} onFinish={refreshAll} />
  </>;
}
