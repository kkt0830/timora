import { Relations } from './Relations';
import { NoteTags, TemplatePicker } from './NoteTools';
import { ApiError } from '../data/http';
import { useEffect, useRef, useState } from 'react';
import type { Note } from '../domain/models';
import { Dialog, Markdown } from './components';
import { messageOf, useAuth, useWorkspace } from './providers';
type Draft = { title: string; content: string; project_id: string | null };
const textOf = (note: Draft) => JSON.stringify({ title: note.title, content: note.content, project_id: note.project_id });
export function NoteAutosaveEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const workspace = useWorkspace(); const { account } = useAuth();
  const key = `timora:note-draft:${account!.id}:${note.id}`;
  const initial = { title: note.title, content: note.content, project_id: note.project_id };
  const [draft, setDraft] = useState<Draft>(initial);
  const [recovery, setRecovery] = useState<Draft | null>(() => {
    try { const v = JSON.parse(localStorage.getItem(key) ?? 'null'); return v && typeof v.title === 'string' && v.title.length <= 300 && typeof v.content === 'string' && v.content.length <= 1000000 && (v.project_id === null || typeof v.project_id === 'string') && textOf(v) !== textOf(initial) ? v : null; } catch { return null; }
  });
  const [preview, setPreview] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [attempt, setAttempt] = useState(0);
  const retries = useRef(0), retryTimer = useRef<number | undefined>(undefined);
  const committed = useRef(textOf(initial)), current = useRef(draft), inFlight = useRef(false), mounted = useRef(true);
  const [saved, setSaved] = useState(textOf(initial)); current.current = draft;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; window.clearTimeout(retryTimer.current); }; }, []);
  const changed = textOf(draft) !== saved;
  const remote = workspace.data.notes.find(n => n.id === note.id);
  const conflict = !remote || (textOf(remote) !== committed.current && textOf(remote) !== textOf(draft));
  useEffect(() => {
    if (!changed || recovery) return;
    try { localStorage.setItem(key, textOf(draft)); }
    catch { setNotice('임시 초안 보관에 실패했습니다. 앱을 닫기 전에 저장해 주세요.'); }
  }, [draft, changed, key, recovery]);
  async function save() {
    if (inFlight.current || workspace.busy || recovery || conflict) return;
    const value = current.current;
    if (!value.title.trim() || textOf(value) === committed.current) return;
    inFlight.current = true; setSaving(true); setError('');
    try {
      await workspace.save('notes', value, note.id);
      retries.current = 0;
      committed.current = textOf(value);
      if (mounted.current) { setSaved(textOf(value)); setNotice(account?.local ? '기기에 저장했습니다. Cloud 전송 상태는 동기화 화면에서 확인하세요.' : 'Cloud에 저장했습니다.'); }
      if (textOf(current.current) === textOf(value)) { try { localStorage.removeItem(key); } catch { /* committed data remains safe */ } }
    } catch (e) {
      if (mounted.current) {
        setError(messageOf(e));
        if (e instanceof ApiError && (e.status === 0 || e.status === 429 || e.status >= 500) && retries.current < 3) {
          const delay = 1000 * 2 ** retries.current++;
          retryTimer.current = window.setTimeout(() => { if (mounted.current) { setError(''); setAttempt(n => n + 1); } }, delay);
        }
      }
    }
    finally { inFlight.current = false; if (mounted.current) setSaving(false); }
  }
  useEffect(() => {
    if (!changed || saving || workspace.busy || recovery || conflict || error) return;
    const timer = window.setTimeout(() => { void save(); }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, changed, saving, workspace.busy, recovery, conflict, error, attempt]);
  function close() {
    if (saving) return;
    if (changed && !window.confirm('저장되지 않은 변경이 있습니다. 닫을까요? 보관된 임시 초안은 다음에 복구할 수 있습니다.')) return;
    onClose();
  }
  return <Dialog title="노트 수정" busy={saving} onClose={close}>
    {recovery && <div role="status"><p>이 기기에 저장되지 않은 초안이 있습니다. 현재 노트와 비교한 뒤 복구할 수 있습니다.</p><details><summary>초안 확인</summary><pre>{recovery.title}{'\n'}{recovery.content}</pre></details><button type="button" onClick={() => { setDraft(recovery); setRecovery(null); }}>초안 복구</button><button type="button" onClick={() => { try { localStorage.removeItem(key); } catch {} setRecovery(null); }}>현재 노트 유지</button></div>}
    {conflict && <p role="alert">다른 곳에서 노트가 변경되었거나 삭제되어 자동 저장을 멈췄습니다. 현재 초안은 보관됩니다. 닫았다가 다시 열어 최신 내용과 비교해 주세요.</p>}
    <label>제목<input name="title" value={draft.title} maxLength={300} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
    <div className="editor-tabs"><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Markdown 편집</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>미리보기</button></div>
    <label hidden={preview}>내용<textarea name="content" rows={14} maxLength={1000000} className="markdown-input" value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} /></label>{preview && <Markdown content={draft.content} />}
    <label>프로젝트<select name="project_id" value={draft.project_id ?? ''} onChange={e => setDraft({ ...draft, project_id: e.target.value || null })}><option value="">연결 없음</option>{workspace.data.projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <Relations id={note.id} kind="note"/><NoteTags noteId={note.id}/><TemplatePicker append={text=>setDraft(value=>({...value,content:value.content+(value.content?'\n\n':'')+text}))}/>

    <p role="status">{saving ? '저장 중…' : changed ? '저장 대기 중' : notice || '저장된 노트'}{notice && changed ? ` · ${notice}` : ''}</p>
    {error && <p role="alert" className="error">{error}<button type="button" onClick={() => { retries.current = 0; setError(''); setAttempt(n => n + 1); }}>다시 저장</button></p>}
    <div className="dialog-actions"><button className="danger-button" disabled={saving || workspace.busy} onClick={() => { if (window.confirm('이 노트를 삭제할까요?')) { setSaving(true); void workspace.remove('notes', note.id).then(() => { try { localStorage.removeItem(key); } catch {} onClose(); }).catch(e => { setError(messageOf(e)); setSaving(false); }); } }}>삭제</button><button type="button" disabled={saving} onClick={close}>닫기</button><button type="button" disabled={saving || conflict || !!recovery || workspace.busy} onClick={() => { void save().then(() => { if (textOf(current.current) === committed.current) onClose(); }); }}>저장</button></div>
  </Dialog>;
}
