import { useState } from 'react';
import type { FormEvent } from 'react';
import type { EntityInput, EntityMap, EntityTable } from '../domain/models';
import { dateKey, localDateTime } from '../domain/dates';
import { Dialog, Markdown } from './components';
import { messageOf, useWorkspace } from './providers';

export const labels: Record<EntityTable, string> = { tasks: '작업', notes: '노트', projects: '프로젝트', events: '일정', library_items: '자료', inbox_items: 'Inbox 기록' };
export type EditorTarget = { table: EntityTable; item?: EntityMap[EntityTable]; projectId?: string; day?: string };

function parseForm(table: EntityTable, form: FormData): EntityInput<EntityTable> {
  const text = (key: string) => String(form.get(key) ?? '');
  const nullable = (key: string) => text(key) || null;
  const title = text('title').trim(); const project_id = nullable('project_id'); const description = text('description');
  switch (table) {
    case 'tasks': return { title, description, status: text('status') as EntityMap['tasks']['status'], priority: text('priority') as EntityMap['tasks']['priority'], start_date: nullable('start_date'), due_date: nullable('due_date'), project_id };
    case 'notes': return { title, content: text('content'), project_id };
    case 'projects': return { name: title, description, status: text('status') as EntityMap['projects']['status'], color: text('color') };
    case 'events': {
      const start = new Date(text('start_at')); const end = new Date(text('end_at'));
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new Error('시작과 종료 시간을 입력해 주세요.');
      return { title, description, start_at: start.toISOString(), end_at: end.toISOString(), project_id };
    }
    case 'library_items': return { title, description, url: text('url').trim(), type: text('type') as EntityMap['library_items']['type'], project_id };
    case 'inbox_items': return { content: text('content').trim(), type: text('type') as EntityMap['inbox_items']['type'] };
  }
}
export function ProjectField({ value = '' }: { value?: string | null }) {
  const { data } = useWorkspace();
  return <label>프로젝트<select name="project_id" defaultValue={value ?? ''}><option value="">개인 작업 / 연결 없음</option>{data.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>;
}
export function EntityEditor({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const workspace = useWorkspace(); const { table, item } = target;
  const row = (item ?? {}) as Record<string, string | null | undefined>;
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [content, setContent] = useState(row.content ?? '');
  const day = target.day ?? dateKey();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (workspace.busy) return;
    setError('');
    try { await workspace.save(table, parseForm(table, new FormData(event.currentTarget)), item?.id); onClose(); }
    catch (e) { setError(messageOf(e)); }
  }
  async function remove() {
    if (!item || workspace.busy) return;
    const warning = table === 'projects' ? '프로젝트를 삭제할까요? 연결된 작업·노트·일정·자료는 개인 항목으로 남습니다.' : '이 항목을 삭제할까요? 되돌릴 수 없습니다.';
    if (!window.confirm(warning)) return;
    setError('');
    try { await workspace.remove(table, item.id); onClose(); } catch (e) { setError(messageOf(e)); }
  }
  return <Dialog title={`${labels[table]} ${item ? '수정' : '추가'}`} busy={workspace.busy} onClose={onClose}><form onSubmit={submit}><fieldset disabled={workspace.busy}>
    {table !== 'inbox_items' && <label>{table === 'projects' ? '프로젝트 이름' : '제목'}<input name="title" defaultValue={row.title ?? row.name ?? ''} maxLength={300} required autoFocus /></label>}
    {table === 'inbox_items' && <><label>빠르게 기록<textarea name="content" defaultValue={row.content ?? ''} maxLength={20000} rows={6} required autoFocus placeholder="지금 떠오른 생각을 적어 보세요." /></label><label>분류<select name="type" defaultValue={row.type ?? 'unclassified'}><option value="unclassified">미분류</option><option value="task">Task</option><option value="note">Note</option><option value="event">Event</option><option value="project">Project</option><option value="resource">Library</option></select></label><small>Task·Note로는 바로 이동할 수 있습니다. 다른 종류는 분류 표시를 먼저 저장합니다.</small></>}
    {['tasks', 'projects', 'events', 'library_items'].includes(table) && <label>설명<textarea name="description" defaultValue={row.description ?? ''} rows={3} /></label>}
    {table === 'tasks' && <><div className="form-grid"><label>상태<select name="status" defaultValue={row.status ?? 'todo'}><option value="todo">미완료</option><option value="in_progress">진행 중</option><option value="done">완료</option></select></label><label>우선순위<select name="priority" defaultValue={row.priority ?? 'medium'}><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></label></div><div className="form-grid"><label>시작일<input type="date" name="start_date" defaultValue={row.start_date ?? ''} /></label><label>마감일<input type="date" name="due_date" defaultValue={row.due_date ?? target.day ?? ''} /></label></div></>}
    {table === 'notes' && <><div className="editor-tabs"><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Markdown 편집</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>미리보기</button></div><label hidden={preview}>내용<textarea name="content" value={content} onChange={event => setContent(event.target.value)} rows={14} maxLength={1000000} className="markdown-input" /></label>{preview && <Markdown content={content} />}<small>제목, 목록, 인용, 코드 블록, 굵은 글씨, 링크를 미리 볼 수 있습니다. HTML은 실행하지 않습니다.</small></>}
    {table === 'projects' && <div className="form-grid"><label>상태<select name="status" defaultValue={row.status ?? 'active'}><option value="active">진행 중</option><option value="paused">보류</option><option value="completed">완료</option></select></label><label>프로젝트 색상<input name="color" type="color" defaultValue={row.color ?? '#6b77dc'} /></label></div>}
    {table === 'events' && <><div className="form-grid"><label>시작<input name="start_at" type="datetime-local" defaultValue={row.start_at ? localDateTime(row.start_at) : `${day}T09:00`} required /></label><label>종료<input name="end_at" type="datetime-local" defaultValue={row.end_at ? localDateTime(row.end_at) : `${day}T10:00`} required /></label></div><small>현재 기기의 시간대로 입력하고 표시합니다.</small></>}
    {table === 'library_items' && <><label>URL<input name="url" type="url" defaultValue={row.url ?? ''} required placeholder="https://…" /></label><label>자료 종류<select name="type" defaultValue={row.type ?? 'website'}>{Object.entries({ website: 'Website', article: 'Article', github: 'GitHub Repository', video: 'Video', pdf: 'PDF', file: 'File URL', other: 'Other' }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></>}
    {!['projects', 'inbox_items'].includes(table) && <ProjectField value={row.project_id ?? target.projectId} />}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="dialog-actions">{item && <button type="button" className="danger-button" onClick={() => void remove()}>삭제</button>}<button type="button" onClick={onClose}>취소</button><button className="primary-button" type="submit">{workspace.busy ? '저장 중…' : '저장'}</button></div>
  </fieldset></form></Dialog>;
}
