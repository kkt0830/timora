import { useState } from 'react';
import type { Task } from '../domain/models';
import type { OpenEditor } from './rows';
import { TaskList } from './rows';
import { useWorkspace, messageOf } from './providers';
const columns = { todo: '미완료', in_progress: '진행 중', done: '완료' };
export function ProjectBoard({ tasks, open }: { tasks: Task[]; open: OpenEditor }) {
  const { save, busy, data, reorderBoard } = useWorkspace();
  const [board, setBoard] = useState(true);
  const [sort, setSort] = useState('manual');
  const [limit,setLimit]=useState(100);
  const positions=new Map(data.board_positions.map(p=>[p.task_id,p.position]));
  const [error, setError] = useState('');
  async function move(id: string, status: Task['status']) {
    const task = tasks.find(t => t.id === id);
    if (!task || busy || task.status === status) return;
    setError('');
    try { await save('tasks', { title: task.title, description: task.description, priority: task.priority, start_date: task.start_date, due_date: task.due_date, project_id: task.project_id, status }, id); }
    catch (e) { setError(messageOf(e)); }
  }
  const priorities = { high: 0, medium: 1, low: 2 };
  const ordered = [...tasks].sort((a, b) => (sort === 'manual' ? (positions.get(a.id)??2147483647)-(positions.get(b.id)??2147483647) : sort === 'priority' ? priorities[a.priority] - priorities[b.priority] : sort === 'title' ? a.title.localeCompare(b.title) : (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')) || a.id.localeCompare(b.id));
  const groups=Object.fromEntries(Object.keys(columns).map(status=>[status,ordered.filter(t=>t.status===status)])) as Record<Task['status'],Task[]>;
  async function reorder(id: string, offset: number) {
    const task=tasks.find(t=>t.id===id); if(!task?.project_id||busy)return;
    const column=ordered.filter(t=>t.status===task.status);const index=column.findIndex(t=>t.id===id);const other=column[index+offset];if(!other)return;
    const ids=ordered.map(t=>t.id);const a=ids.indexOf(id),b=ids.indexOf(other.id);[ids[a],ids[b]]=[ids[b],ids[a]];
    setError('');try{await reorderBoard(task.project_id,ids);}catch(e){setError(messageOf(e));}
  }
  return <section aria-label="프로젝트 작업 보기">
    <div className="period-filters"><button type="button" aria-pressed={board} onClick={() => setBoard(true)}>보드</button><button type="button" aria-pressed={!board} onClick={() => setBoard(false)}>목록</button><label>정렬<select value={sort} onChange={e => setSort(e.target.value)}><option value="manual">수동 순서</option><option value="due">마감일</option><option value="priority">우선순위</option><option value="title">제목</option></select></label></div>
    {error && <p className="error" role="alert">{error}</p>}
    {board&&Object.values(groups).some(rows=>rows.length>limit)&&<button type="button" onClick={()=>setLimit(n=>n+100)}>보드 작업 100개 더 보기</button>}
    {board ? <div className="kanban-board">{(Object.keys(columns) as Task['status'][]).map(status => <section className="kanban-column" key={status} aria-label={columns[status]} onDragOver={e => { if (!busy) e.preventDefault(); }} onDrop={e => { e.preventDefault(); void move(e.dataTransfer.getData('application/x-timora-task'), status); }}>
      <h3>{columns[status]} · {groups[status].length}</h3>
      {groups[status].slice(0,limit).map(task => <article key={task.id} className="card kanban-task" draggable={!busy} onDragStart={e => { e.dataTransfer.setData('application/x-timora-task', task.id); e.dataTransfer.effectAllowed = 'move'; }}>
        <button type="button" className="row-title" onClick={() => open({ table: 'tasks', item: task })}>{task.title}</button><small>{task.priority === 'high' ? '높음' : task.priority === 'low' ? '낮음' : '보통'} · {task.due_date ?? '마감일 없음'}</small>
        {sort==='manual'&&data.tools_available&&<div className="period-filters"><button type="button" aria-label={`${task.title} 위로`} disabled={busy||groups[status][0]?.id===task.id} onClick={()=>void reorder(task.id,-1)}>위로</button><button type="button" aria-label={`${task.title} 아래로`} disabled={busy||groups[status].at(-1)?.id===task.id} onClick={()=>void reorder(task.id,1)}>아래로</button></div>}
        <label>상태 이동<select aria-label={`${task.title} 상태 이동`} value={task.status} disabled={busy} onChange={e => void move(task.id, e.target.value as Task['status'])}>{Object.entries(columns).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      </article>)}
    </section>)}</div> : <TaskList tasks={ordered} open={open} />}
  </section>;
}
