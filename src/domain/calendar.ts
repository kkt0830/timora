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

/** Parse event instants and local day boundaries once per visible period. */
export function indexCalendar<E extends {start_at:string;end_at:string},T extends {due_date:string|null}>(events:E[],tasks:T[],keys:string[]):Map<string,{events:E[];tasks:T[]}> {
 const buckets=new Map(keys.map(key=>[key,{events:[] as E[],tasks:[] as T[]}]));
 const ranges=keys.map(key=>{const start=localDate(key);return {key,start:+start,end:+new Date(start.getFullYear(),start.getMonth(),start.getDate()+1)};});
 for(const event of events){const start=Date.parse(event.start_at),end=Date.parse(event.end_at);for(const range of ranges)if(start<range.end&&end>range.start)buckets.get(range.key)!.events.push(event);}
 for(const task of tasks)if(task.due_date)buckets.get(task.due_date)?.tasks.push(task);
 return buckets;
}
