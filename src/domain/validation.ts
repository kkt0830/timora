import { validateRecurrence } from './recurrence.ts';
import { routineRule } from './routines.ts';
import type { Routine } from './models.ts';
import type { EntityInput, EntityTable } from './models.ts';

export function safeUrl(value: string): string | null {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function validDate(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateInput<K extends EntityTable>(table: K, input: EntityInput<K>): void {
  const row = input as unknown as Record<string, unknown>;
  const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  if (table === 'tags') { if (typeof row.name !== 'string' || !row.name.trim() || row.name.length>80 || !/^#[0-9a-f]{6}$/i.test(String(row.color))) throw new Error('태그 이름·색상을 확인해 주세요.'); return; }
  if (table === 'note_templates') { if (typeof row.title !== 'string' || !row.title.trim() || row.title.length>300 || typeof row.content !== 'string' || row.content.length>1000000) throw new Error('템플릿 제목·내용을 확인해 주세요.'); return; }
  if (table === 'note_tags') { if (!uuid(row.note_id) || !uuid(row.tag_id)) throw new Error('태그 연결을 확인해 주세요.'); return; }
  if (table === 'task_blocks' || table === 'board_positions') {
    if (!uuid(row.task_id)) throw new Error('Task 연결을 확인해 주세요.');
    if (table === 'board_positions' && (!Number.isInteger(row.position) || Number(row.position)<0 || Number(row.position)>2147483647)) throw new Error('보드 순서 오류');
    if (table === 'task_blocks' && (!Number.isFinite(Date.parse(String(row.start_at))) || !Number.isFinite(Date.parse(String(row.end_at))) || Date.parse(String(row.start_at))>=Date.parse(String(row.end_at)))) throw new Error('종료 시간은 시작 이후여야 합니다.');
    return;
  }
  if (table === 'routine_completions') {
    if (!/^[0-9a-f-]{36}$/i.test(String(row.routine_id)) || typeof row.local_date !== 'string' || !validDate(row.local_date) || !['todo','done'].includes(String(row.status))) throw new Error('루틴 완료 기록을 확인해 주세요.');
    return;
  }
  if (table === 'routines') { validateRecurrence(routineRule(input as unknown as Routine)); if (!['active','paused','archived'].includes(String(row.status))) throw new Error('루틴 상태 오류'); }
  const label = table === 'projects' ? row.name : table === 'inbox_items' ? row.content : row.title;
  if (typeof label !== 'string' || !label.trim()) throw new Error('제목 또는 내용을 입력해 주세요.');
  if (label.length > (table === 'inbox_items' ? 20000 : 300)) throw new Error('제목은 300자, Inbox 내용은 20,000자 이내로 입력해 주세요.');
  if (table === 'subtasks') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(row.task_id)) || !['todo', 'done'].includes(String(row.status)) || !Number.isInteger(row.position) || Number(row.position) < 0 || Number(row.position) > 2147483647) throw new Error('하위 작업의 연결·상태·순서를 확인해 주세요.');
  }
  if (table === 'tasks') {
    if (!['todo', 'in_progress', 'done'].includes(String(row.status)) || !['low', 'medium', 'high'].includes(String(row.priority))) throw new Error('작업 상태 또는 우선순위가 올바르지 않습니다.');
    if (!validDate(row.start_date) || !validDate(row.due_date)) throw new Error('올바른 날짜를 입력해 주세요.');
    if (row.start_date && row.due_date && row.start_date > row.due_date) throw new Error('마감일은 시작일 이후여야 합니다.');
  }
  if (table === 'events' && (!Number.isFinite(Date.parse(String(row.start_at))) || !Number.isFinite(Date.parse(String(row.end_at))) || Date.parse(String(row.start_at)) >= Date.parse(String(row.end_at)))) throw new Error('종료 시간은 시작 시간 이후여야 합니다.');
  if (table === 'library_items' && !safeUrl(String(row.url))) throw new Error('http 또는 https URL을 입력해 주세요.');
}
