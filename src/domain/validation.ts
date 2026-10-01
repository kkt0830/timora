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
  const label = table === 'projects' ? row.name : table === 'inbox_items' ? row.content : row.title;
  if (typeof label !== 'string' || !label.trim()) throw new Error('제목 또는 내용을 입력해 주세요.');
  if (label.length > (table === 'inbox_items' ? 20000 : 300)) throw new Error('제목은 300자, Inbox 내용은 20,000자 이내로 입력해 주세요.');
  if (table === 'tasks') {
    if (!['todo', 'in_progress', 'done'].includes(String(row.status)) || !['low', 'medium', 'high'].includes(String(row.priority))) throw new Error('작업 상태 또는 우선순위가 올바르지 않습니다.');
    if (!validDate(row.start_date) || !validDate(row.due_date)) throw new Error('올바른 날짜를 입력해 주세요.');
    if (row.start_date && row.due_date && row.start_date > row.due_date) throw new Error('마감일은 시작일 이후여야 합니다.');
  }
  if (table === 'events' && (!Number.isFinite(Date.parse(String(row.start_at))) || !Number.isFinite(Date.parse(String(row.end_at))) || Date.parse(String(row.start_at)) >= Date.parse(String(row.end_at)))) throw new Error('종료 시간은 시작 시간 이후여야 합니다.');
  if (table === 'library_items' && !safeUrl(String(row.url))) throw new Error('http 또는 https URL을 입력해 주세요.');
}
