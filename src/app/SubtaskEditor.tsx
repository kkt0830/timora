import { useState } from 'react';
import type { Subtask } from '../domain/models';
import { messageOf, useWorkspace } from './providers';

export function SubtaskEditor({ taskId }: { taskId: string }) {
  const { data, save, remove, reorderSubtasks, busy } = useWorkspace();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [renamed, setRenamed] = useState('');
  const rows = data.subtasks.filter(s => s.task_id === taskId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const done = rows.filter(s => s.status === 'done').length;
  async function perform(action: () => Promise<void>) { setError(''); try { await action(); } catch (e) { setError(messageOf(e)); } }
  async function update(row: Subtask, change: Partial<Pick<Subtask, 'title' | 'status'>>) {
    await save('subtasks', { task_id: taskId, title: row.title, status: row.status, position: row.position, ...change }, row.id);
  }
  return <section className="subtask-editor" aria-label="하위 작업">
    <h3>하위 작업 {rows.length ? `${done}/${rows.length} · ${Math.round(done / rows.length * 100)}%` : ''}</h3>
    <small>하위 작업을 모두 완료해도 Task 상태는 직접 변경합니다. 하위 작업 변경은 즉시 저장됩니다.</small>
    {!data.subtasks_available ? <p>Cloud 서버 업데이트 후 하위 작업을 사용할 수 있습니다.</p> : <>
      {rows.length > 0 && <progress aria-label="하위 작업 진행률" value={done} max={rows.length} />}
      <ul>{rows.map((row, index) => <li key={row.id}>
        <label className="subtask-title"><input type="checkbox" checked={row.status === 'done'} disabled={busy} onChange={() => void perform(() => update(row, { status: row.status === 'done' ? 'todo' : 'done' }))} />{row.title}</label>
        {editing === row.id ? <div className="subtask-actions"><input aria-label="하위 작업 새 이름" maxLength={300} value={renamed} onChange={e => setRenamed(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} /><button type="button" disabled={busy || !renamed.trim()} onClick={() => void perform(async () => { await update(row, { title: renamed.trim() }); setEditing(null); })}>이름 저장</button><button type="button" onClick={() => setEditing(null)}>이름 변경 취소</button></div> : <div className="subtask-actions">
          <button type="button" aria-label={`${row.title} 이름 변경`} onClick={() => { setEditing(row.id); setRenamed(row.title); }}>이름 변경</button>
          {([-1, 1] as const).map(delta => <button type="button" key={delta} aria-label={`${row.title} ${delta < 0 ? '위로' : '아래로'}`} disabled={busy || index + delta < 0 || index + delta >= rows.length} onClick={() => void perform(async () => { const ids = rows.map(s => s.id); [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]; await reorderSubtasks(taskId, ids); })}>{delta < 0 ? '↑' : '↓'}</button>)}
          <button type="button" aria-label={`${row.title} 하위 작업 삭제`} disabled={busy} onClick={() => { if (window.confirm('이 하위 작업을 삭제할까요?')) void perform(() => remove('subtasks', row.id)); }}>삭제</button>
        </div>}
      </li>)}</ul>
      <div className="subtask-actions"><input aria-label="새 하위 작업" value={title} maxLength={300} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} /><button type="button" disabled={busy || !title.trim()} onClick={() => void perform(async () => { await save('subtasks', { task_id: taskId, title: title.trim(), status: 'todo', position: rows.length ? Math.max(...rows.map(s => s.position)) + 1 : 0 }); setTitle(''); })}>하위 작업 추가</button></div>
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
