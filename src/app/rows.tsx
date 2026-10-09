import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Check, FileText } from 'lucide-react';
import type { CalendarEvent, LibraryItem, Note, Task } from '../domain/models';
import { dateKey, formatInstant } from '../domain/dates';
import { safeUrl } from '../domain/validation';
import { messageOf, useWorkspace } from './providers';
import type { EditorTarget } from './EntityEditor';
import { Empty } from './components';
import { ExternalLink } from './ExternalLink';

export type OpenEditor = (target: EditorTarget) => void;
export function ProjectLabel({ id }: { id: string | null }) {
  const { data } = useWorkspace(); const project = data.projects.find(p => p.id === id);
  return project ? <NavLink to={`/projects/${project.id}`}>{project.name}</NavLink> : <span>개인 항목</span>;
}
export function TaskRow({ task, open }: { task: Task; open: OpenEditor }) {
  const { save, busy } = useWorkspace(); const [error, setError] = useState('');
  async function toggle() {
    setError('');
    const { id, user_id: _user, created_at: _created, updated_at: _updated, ...input } = task;
    try { await save('tasks', { ...input, status: task.status === 'done' ? 'todo' : 'done' }, id); } catch (e) { setError(messageOf(e)); }
  }
  return <><div className="task-row"><button type="button" className={`checkbox-mock${task.status === 'done' ? ' checked' : ''}`} aria-label={`${task.title} ${task.status === 'done' ? '미완료로' : '완료로'} 변경`} aria-pressed={task.status === 'done'} disabled={busy} onClick={() => void toggle()}>{task.status === 'done' && <Check size={13} />}</button><div className="task-main"><button type="button" className={`row-title${task.status === 'done' ? ' done-text' : ''}`} onClick={() => open({ table: 'tasks', item: task })}>{task.title}</button><small><ProjectLabel id={task.project_id} />{task.status === 'in_progress' && ' · 진행 중'}</small></div><span className={`priority ${task.priority}`}>{task.priority === 'high' ? '중요' : task.priority === 'medium' ? '보통' : '낮음'}</span><time className={`task-date${task.status !== 'done' && task.due_date && task.due_date < dateKey() ? ' overdue' : ''}`} dateTime={task.due_date ?? undefined}>{task.status !== 'done' && task.due_date && task.due_date < dateKey() ? '기한 지남 · ' : ''}{task.due_date ?? '날짜 없음'}</time></div>{error && <p className="error" role="alert">{error}</p>}</>;
}
export function TaskList({ tasks, open }: { tasks: Task[]; open: OpenEditor }) { return tasks.length ? <div>{tasks.map(task => <TaskRow key={task.id} task={task} open={open} />)}</div> : <Empty />; }
export function EventList({ events, open }: { events: CalendarEvent[]; open: OpenEditor }) {
  return events.length ? <div className="event-list">{events.map(event => <div className="event-row" key={event.id}><div className="event-date"><strong>{new Date(event.start_at).getDate()}</strong><span>{new Date(event.start_at).getMonth() + 1}월</span></div><div><button className="row-title" type="button" onClick={() => open({ table: 'events', item: event })}>{event.title}</button><small>{formatInstant(event.start_at)} – {formatInstant(event.end_at)}</small><small><ProjectLabel id={event.project_id} /></small></div></div>)}</div> : <Empty>예정된 일정이 없습니다.</Empty>;
}
export function NoteList({ notes, open }: { notes: Note[]; open: OpenEditor }) {
  return notes.length ? <div className="notes-grid">{notes.map(note => <article className="card note-card" key={note.id}><div className="note-actions"><span className="note-symbol"><FileText size={19} /></span><button type="button" className="text-link" aria-label={`${note.title} 수정 / 삭제`} onClick={() => open({ table: 'notes', item: note })}>수정 / 삭제</button></div><h2><button type="button" className="row-title" onClick={() => open({ table: 'notes', item: note })}>{note.title}</button></h2><p className="note-excerpt">{note.content.slice(0, 160) || '내용을 기록해 보세요.'}</p><div className="note-footer"><ProjectLabel id={note.project_id} /><time dateTime={note.updated_at}>{new Date(note.updated_at).toLocaleDateString('ko-KR')}</time></div></article>)}</div> : <Empty />;
}
export function LibraryList({ items, open }: { items: LibraryItem[]; open: OpenEditor }) {
  return items.length ? <div>{items.map(item => <div className="list-row" key={item.id}><div><button type="button" className="row-title" onClick={() => open({ table: 'library_items', item })}>{item.title}</button><small>{item.description}</small><small><ProjectLabel id={item.project_id} /></small>{safeUrl(item.url) && <ExternalLink className="resource-url" href={item.url}>{item.url} ↗</ExternalLink>}</div><span className="row-tag">{item.type}</span></div>)}</div> : <Empty />;
}
