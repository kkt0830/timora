import { dateKey, localDate, monthDays } from './dates.ts';
export type CalendarView = 'month' | 'week' | 'day';
export function periodDays(day: string, view: CalendarView): string[] {
  const date = localDate(day);
  if (view === 'month') return monthDays(date).map(dateKey);
  const first = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (view === 'week' ? date.getDay() : 0));
  return Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) => dateKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i)));
}
export function shiftPeriod(day: string, view: CalendarView, amount: number): string {
  const date = localDate(day);
  return dateKey(view === 'month' ? new Date(date.getFullYear(), date.getMonth() + amount, 1) : new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount * (view === 'week' ? 7 : 1)));
}
