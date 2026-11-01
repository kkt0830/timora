import { useState } from 'react';
import type { Task } from '../domain/models';
import type { OpenEditor } from './rows';
import { TaskList } from './rows';
import { useWorkspace, messageOf } from './providers';
const columns = { todo: '미완료', in_progress: '진행 중', done: '완료' };
export function ProjectBoard({ tasks, open }: { tasks: Task[]; open: OpenEditor }) {
  const { save, busy } = useWorkspace();
  const [board, setBoard] = useState(true);
  const [sort, setSort] = useState('due');
  const [error, setError] = useState('');
  async function move(id: string, status: Task['status']) {
    const task = tasks.find(t => t.id === id);
    if (!task || busy || task.status === status) return;
    setError('');
    try { await save('tasks', { title: task.title, description: task.description, priority: task.priority, start_date: task.start_date, due_date: task.due_date, project_id: task.project_id, status }, id); }
    catch (e) { setError(messageOf(e)); }
  }
  const priorities = { high: 0, medium: 1, low: 2 };
  const ordered = [...tasks].sort((a, b) => (sort === 'priority' ? priorities[a.priority] - priorities[b.priority] : sort === 'title' ? a.title.localeCompare(b.title) : (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')) || a.id.localeCompare(b.id));
  return <section aria-label="프로젝트 작업 보기">
    <div className="period-filters"><button type="button" aria-pressed={board} onClick={() => setBoard(true)}>보드</button><button type="button" aria-pressed={!board} onClick={() => setBoard(false)}>목록</button><label>정렬<select value={sort} onChange={e => setSort(e.target.value)}><option value="due">마감일</option><option value="priority">우선순위</option><option value="title">제목</option></select></label></div>
    {error && <p className="error" role="alert">{error}</p>}
    {board ? <div className="kanban-board">{(Object.keys(columns) as Task['status'][]).map(status => <section className="kanban-column" key={status} aria-label={columns[status]} onDragOver={e => { if (!busy) e.preventDefault(); }} onDrop={e => { e.preventDefault(); void move(e.dataTransfer.getData('application/x-timora-task'), status); }}>
      <h3>{columns[status]} · {ordered.filter(t => t.status === status).length}</h3>
      {ordered.filter(t => t.status === status).map(task => <article key={task.id} className="card kanban-task" draggable={!busy} onDragStart={e => { e.dataTransfer.setData('application/x-timora-task', task.id); e.dataTransfer.effectAllowed = 'move'; }}>
        <button type="button" className="row-title" onClick={() => open({ table: 'tasks', item: task })}>{task.title}</button><small>{task.priority === 'high' ? '높음' : task.priority === 'low' ? '낮음' : '보통'} · {task.due_date ?? '마감일 없음'}</small>
        <label>상태 이동<select aria-label={`${task.title} 상태 이동`} value={task.status} disabled={busy} onChange={e => void move(task.id, e.target.value as Task['status'])}>{Object.entries(columns).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      </article>)}
    </section>)}</div> : <TaskList tasks={ordered} open={open} />}
  </section>;
}
