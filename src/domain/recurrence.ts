/** Date-only recurrence: timezone selects today, never shifts stored calendar dates. */
export interface RecurrenceRule {
  id: string; frequency: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';
  interval: number; start: string; end: string | null; limit: number | null;
  weekdays: number[]; timezone: string; paused: boolean;
}
const DAY = 86400000;
function parse(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) throw new Error('올바른 날짜를 입력해 주세요.');
  return date;
}
export function validateRecurrence(rule: RecurrenceRule): void {
  parse(rule.start);
  if (rule.end && (+parse(rule.end) < +parse(rule.start))) throw new Error('반복 종료일을 확인해 주세요.');
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 366) throw new Error('반복 간격은 1~366입니다.');
  if (rule.limit !== null && (!Number.isInteger(rule.limit) || rule.limit < 1 || rule.limit > 10000)) throw new Error('반복 횟수는 1~10000입니다.');
  if (!['daily', 'weekdays', 'weekly', 'monthly', 'yearly'].includes(rule.frequency)) throw new Error('반복 주기를 확인해 주세요.');
  if (rule.weekdays.some(n => !Number.isInteger(n) || n < 0 || n > 6) || new Set(rule.weekdays).size !== rule.weekdays.length) throw new Error('요일을 확인해 주세요.');
  new Intl.DateTimeFormat('en', { timeZone: rule.timezone }).format();
}
export function dateInZone(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
/** Month/year overflow is skipped, not silently moved (Jan 31 skips February).
 * Enumerates at most 100 years and returns at most 366 occurrences per request.
 * History belongs in a separate table; editing a rule never rewrites it here.
 */
export function occurrences(rule: RecurrenceRule, from: string, through: string): string[] {
  validateRecurrence(rule);
  const start = parse(rule.start), lower = parse(from), upper = parse(through);
  if (+upper < +lower || (+upper - +start) / DAY > 36600) throw new Error('반복 조회 범위를 확인해 주세요.');
  if (rule.paused) return [];
  const result: string[] = []; let count = 0;
  const end = rule.end ? Math.min(+upper, +parse(rule.end)) : +upper;
  for (let time = +start; time <= end; time += DAY) {
    const date = new Date(time), days = Math.round((time - +start) / DAY);
    const months = (date.getUTCFullYear() - start.getUTCFullYear()) * 12 + date.getUTCMonth() - start.getUTCMonth();
    const weekdays = rule.weekdays.length ? rule.weekdays : [start.getUTCDay()];
    const matches = rule.frequency === 'daily' ? days % rule.interval === 0
      : rule.frequency === 'weekdays' ? days % rule.interval === 0 && date.getUTCDay() !== 0 && date.getUTCDay() !== 6
      : rule.frequency === 'weekly' ? Math.floor((days + (start.getUTCDay() + 6) % 7) / 7) % rule.interval === 0 && weekdays.includes(date.getUTCDay())
      : rule.frequency === 'monthly' ? months % rule.interval === 0 && date.getUTCDate() === start.getUTCDate()
      : (date.getUTCFullYear() - start.getUTCFullYear()) % rule.interval === 0 && date.getUTCMonth() === start.getUTCMonth() && date.getUTCDate() === start.getUTCDate();
    if (!matches) continue;
    if (rule.limit !== null && ++count > rule.limit) break;
    if (time >= +lower) { result.push(date.toISOString().slice(0, 10)); if (result.length > 366) throw new Error('한 번에 366회 이하로 조회해 주세요.'); }
  }
  return result;
}
