import type { Routine } from './models.ts';
import type { RecurrenceRule } from './recurrence.ts';
export function routineRule(r: Routine): RecurrenceRule {
  return { id: r.id, frequency: r.frequency, interval: r.interval_days, start: r.start_date, end: r.end_date, limit: r.occurrence_limit, weekdays: r.weekdays ? r.weekdays.split(',').map(Number) : [], timezone: r.timezone, paused: r.status !== 'active' };
}
export async function routineCompletionId(routineId: string, day: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${routineId.toLowerCase()}:${day}`));
  const hex = Array.from(new Uint8Array(bytes).slice(0,16), b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
