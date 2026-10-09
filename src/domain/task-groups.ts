import type { Task } from './models.ts';
import { dateKey, localDate, taskOnDay } from './dates.ts';
export const groupLabels = { overdue: '기한 지남', today: '오늘', week: '이번 주', month: '이번 달', later: '나중에', long: '장기', unscheduled: '일정 없음', completed: '완료한 기록' };
export type TaskGroup = keyof typeof groupLabels;
export type PeriodFilter = 'all' | 'today' | 'week' | 'month';
export function addDays(key: string, days: number): string { const d = localDate(key); return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)); }
export function endOfWeek(key: string): string { const weekday = localDate(key).getDay(); return addDays(key, (7 - weekday) % 7); }
export function endOfMonth(key: string): string { const d = localDate(key); return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
export function calendarDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number); const [ey, em, ed] = end.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000);
}
// Mutually exclusive buckets. Completed historical records are never overdue/future work.
export function taskGroup(task: Task, today: string): TaskGroup {
  const anchor = task.start_date && task.start_date > today ? task.start_date : task.due_date ?? task.start_date;
  if (!task.start_date && !task.due_date) return 'unscheduled';
  if (task.status === 'done' && !taskOnDay(task, today) && anchor && anchor < today) return 'completed';
  if (task.status !== 'done' && task.due_date && task.due_date < today) return 'overdue';
  if (task.start_date && task.due_date && calendarDays(task.start_date, task.due_date) >= 90) return 'long';
  if (taskOnDay(task, today)) return 'today';
  if (anchor && anchor > today && anchor <= endOfWeek(today)) return 'week';
  if (anchor && anchor > today && anchor <= endOfMonth(today)) return 'month';
  return 'later';
}
export function inPeriod(task: Task, today: string, filter: PeriodFilter): boolean {
  if (filter === 'all') return true;
  const overdue = task.status !== 'done' && task.due_date !== null && task.due_date < today;
  if (filter === 'today') return taskOnDay(task, today) || overdue;
  const end = filter === 'week' ? endOfWeek(today) : endOfMonth(today);
  // Future start dates, due dates, or a current open range overlap the period.
  return overdue || taskOnDay(task, today) || [task.start_date, task.due_date].some(date => date !== null && date >= today && date <= end);
}
export function datePreset(today: string, preset: 'today' | 'tomorrow' | 'week' | 'month'): { start_date: string; due_date: string } {
  const start = preset === 'tomorrow' ? addDays(today, 1) : today;
  return { start_date: start, due_date: preset === 'week' ? endOfWeek(today) : preset === 'month' ? endOfMonth(today) : start };
}
export function taskRangeLabel(task: Task, today: string): string {
  const duration = task.start_date && task.due_date ? calendarDays(task.start_date, task.due_date) : 0;
  const durationLabel = duration >= 365 ? `약 ${Math.round(duration / 365.25)}년 (${duration}일)` : duration >= 90 ? `약 ${Math.round(duration / 30.4375)}개월 (${duration}일)` : `${duration}일 기간`;
  const range = task.start_date && task.due_date ? `${task.start_date} → ${task.due_date} · ${durationLabel}` : task.start_date ? `${task.start_date} 시작` : task.due_date ? `${task.due_date} 마감` : '일정 없음';
  if (task.status === 'done' || !task.due_date) return range;
  const days = calendarDays(today, task.due_date);
  return `${range} · ${days < 0 ? `${-days}일 기한 지남` : days === 0 ? '오늘 마감' : `${days}일 남음`}`;
}
