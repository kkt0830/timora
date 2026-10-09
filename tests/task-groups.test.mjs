import test from 'node:test';
import assert from 'node:assert/strict';
import { taskGroup, inPeriod, calendarDays, datePreset, endOfWeek, endOfMonth, taskRangeLabel } from '../src/domain/task-groups.ts';
import { todayTasks } from '../src/domain/dates.ts';
const task = (start_date = null, due_date = null, status = 'todo') => ({ id: 't', title: 't', start_date, due_date, status });

test('each task has one exclusive group with overdue and completed precedence', () => {
  const today = '2026-10-09';
  const cases = [
    [task(null, '2026-10-08'), 'overdue'], [task(null, today), 'today'],
    [task(null, '2026-10-11'), 'week'], [task(null, '2026-10-12'), 'month'],
    [task(null, '2026-10-31'), 'month'], [task(null, '2026-11-01'), 'later'],
    [task('2026-11-01', '2027-02-01'), 'long'], [task(), 'unscheduled'],
    [task(null, '2026-10-08', 'done'), 'completed'],
    [task('2026-01-01', '2026-10-08'), 'overdue'],
    [task('2026-01-01', '2026-10-08', 'done'), 'completed'],
    [task('2026-10-01', '2026-10-20'), 'today'],
    [task('2026-10-10', '2026-10-20'), 'week'],
    [task('2026-10-10', '2026-10-20', 'done'), 'week'],
  ];
  for (const [row, expected] of cases) assert.equal(taskGroup(row, today), expected);
  assert.equal(taskGroup(task('2026-01-01', '2027-01-01'), today), 'long');
});
test('today filter shares Today logic, includes overdue and excludes historical completed ranges', () => {
  const today = '2026-10-09';
  const rows = [task(null, '2026-10-08'), task('2026-01-01', '2027-01-01'), task(null, today, 'done'), task('2026-10-01', '2026-10-20', 'done'), task(), task('2026-10-10')];
  assert.deepEqual(rows.filter(row => inPeriod(row, today, 'today')), todayTasks(rows, today));
  assert.equal(inPeriod(task('2026-10-10', '2026-11-15'), today, 'week'), true);
  assert.equal(inPeriod(task('2026-11-01'), today, 'month'), false);
});
test('week/month and presets handle Sunday, leap day and year rollover without UTC date shifts', () => {
  assert.equal(endOfWeek('2026-10-11'), '2026-10-11');
  assert.equal(endOfWeek('2026-12-31'), '2027-01-03');
  assert.equal(endOfMonth('2028-02-01'), '2028-02-29');
  assert.equal(taskGroup(task(null, '2027-01-02'), '2026-12-31'), 'week');
  assert.deepEqual(datePreset('2026-12-31', 'tomorrow'), { start_date: '2027-01-01', due_date: '2027-01-01' });
  assert.deepEqual(datePreset('2028-02-28', 'month'), { start_date: '2028-02-28', due_date: '2028-02-29' });
  assert.deepEqual(datePreset('2026-10-11', 'week'), { start_date: '2026-10-11', due_date: '2026-10-11' });
});
test('duration and remaining days use calendar days through DST and the 90-day boundary', () => {
  assert.equal(calendarDays('2026-03-07', '2026-03-09'), 2);
  assert.equal(calendarDays('2026-10-31', '2026-11-02'), 2);
  assert.equal(taskGroup(task('2026-01-01', '2026-03-31'), '2025-12-31'), 'week');
  assert.equal(taskGroup(task('2026-01-01', '2026-04-01'), '2025-12-31'), 'long');
  assert.match(taskRangeLabel(task('2026-03-07', '2026-03-09'), '2026-03-07'), /2일 기간 · 2일 남음/);
  assert.doesNotMatch(taskRangeLabel(task(null, '2026-03-07', 'done'), '2026-03-09'), /기한 지남/);
  assert.match(taskRangeLabel(task('2026-01-01', '2029-01-01'), '2026-01-01'), /약 3년/);
});
