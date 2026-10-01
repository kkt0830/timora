import type { CalendarEvent, Task } from './models.ts';

// Tasks store calendar dates, never UTC timestamps. Events store instants.
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function localDate(value: string): Date { return new Date(`${value}T00:00:00`); }
export function localDateTime(value: string): string {
  const date = new Date(value);
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function monthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}
export function eventOnDay(event: CalendarEvent, key: string): boolean {
  const start = localDate(key);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  // Half-open interval; midnight belongs to the preceding day when ending.
  return new Date(event.start_at) < end && new Date(event.end_at) > start;
}
export function taskOnDay(task: Task, key: string): boolean {
  return task.due_date === key || (task.start_date !== null && task.start_date <= key && (task.due_date === null || task.due_date >= key));
}
export function todayTasks(tasks: Task[], key: string): Task[] {
  return tasks.filter(task => taskOnDay(task, key) || (task.status !== 'done' && task.due_date !== null && task.due_date < key));
}
export function formatInstant(value: string): string { return new Date(value).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }); }
