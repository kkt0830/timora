import test from 'node:test';
import assert from 'node:assert/strict';
import { taskGroup, inPeriod, calendarDays, datePreset, endOfWeek, endOfMonth, taskRangeLabel, upcomingDeadlines } from '../src/domain/task-groups.ts';
import { todayTasks } from '../src/domain/dates.ts';
const task = (start_date = null, due_date = null, status = 'todo') => ({ id: 't', title: 't', start_date, due_date, status });

test('upcoming deadlines include only the next seven calendar days of unfinished tasks', () => {
  for (const timezone of ['Asia/Seoul', 'America/New_York']) {
    const previous = process.env.TZ; process.env.TZ = timezone;
    try {
      const rows = [
        task(null, '2027-01-07'), task(null, '2027-01-06'),
        task(null, '2027-01-01'), task(null, '2026-12-31'),
        task(null, '2026-12-30'), task(null, '2027-01-02', 'done'), task(),
      ];
      assert.deepEqual(upcomingDeadlines(rows, '2026-12-31').map(t => t.due_date), ['2027-01-01', '2027-01-06', '2027-01-07']);
      assert.deepEqual(upcomingDeadlines([task(null, '2024-02-29'), task(null, '2024-03-06'), task(null, '2024-03-07')], '2024-02-28').map(t => t.due_date), ['2024-02-29', '2024-03-06']);
      const many = Array.from({ length: 7 }, (_, i) => ({ ...task(null, '2027-01-02'), id: String(i) }));
      assert.equal(upcomingDeadlines(many, '2026-12-31').length, 5);
      assert.equal(rows[0].due_date, '2027-01-07');
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  }
});

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
