import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, eventOnDay, localDate, localDateTime, monthDays, taskOnDay, todayTasks } from '../src/domain/dates.ts';
import { safeUrl, validateInput } from '../src/domain/validation.ts';

const baseTask = { id: 'task', user_id: 'a', title: 'task', description: '', status: 'todo', priority: 'medium', start_date: null, due_date: null, project_id: null, created_at: '', updated_at: '' };
test('Task dates remain calendar dates in multiple device timezones', () => {
  const before = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'Asia/Seoul', 'America/Los_Angeles']) {
      process.env.TZ = timezone;
      assert.equal(dateKey(localDate('2026-10-01')), '2026-10-01');
      assert.equal(taskOnDay({ ...baseTask, due_date: '2026-10-01' }, '2026-10-01'), true);
    }
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});
test('Today includes scheduled and overdue open tasks, excludes old completed tasks and unscheduled ones', () => {
  const tasks = [
    { ...baseTask, id: 'today', due_date: '2026-10-01', status: 'done' },
    { ...baseTask, id: 'overdue', due_date: '2026-09-30' },
    { ...baseTask, id: 'old-done', due_date: '2026-09-30', status: 'done' },
    { ...baseTask, id: 'unscheduled' },
    { ...baseTask, id: 'started', start_date: '2026-09-30', due_date: '2026-10-03' },
  ];
  assert.deepEqual(todayTasks(tasks, '2026-10-01').map(task => task.id), ['today', 'overdue', 'started']);
});
test('Events use local day overlap and exclude a midnight end', () => {
  const before = process.env.TZ; process.env.TZ = 'Asia/Seoul';
  try {
    const event = { start_at: '2026-09-30T14:00:00Z', end_at: '2026-09-30T15:00:00Z' };
    assert.equal(eventOnDay(event, '2026-09-30'), true);
    assert.equal(eventOnDay(event, '2026-10-01'), false);
    assert.equal(eventOnDay({ ...event, end_at: '2026-09-30T16:00:00Z' }, '2026-10-01'), true);
    assert.equal(localDateTime('2026-09-30T15:30:00Z'), '2026-10-01T00:30');
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});
test('Calendar generates six complete weeks and handles December/year boundaries', () => {
  const days = monthDays(new Date(2026, 11, 1));
  assert.equal(days.length, 42); assert.equal(days[0].getDay(), 0); assert.equal(days[41].getDay(), 6);
  assert.equal(dateKey(days[0]), '2026-11-29'); assert.equal(dateKey(days[41]), '2027-01-09');
});
test('URL validation rejects executable protocols and malformed URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'not a url']) assert.equal(safeUrl(url), null);
  assert.equal(safeUrl('https://example.com'), 'https://example.com/');
});
test('Validation rejects invalid dates, date ranges and empty titles', () => {
  assert.throws(() => validateInput('tasks', { ...baseTask, title: '  ' }));
  assert.throws(() => validateInput('tasks', { ...baseTask, due_date: '2026-02-30' }));
  assert.throws(() => validateInput('tasks', { ...baseTask, start_date: '2026-10-03', due_date: '2026-10-01' }));
  assert.throws(() => validateInput('events', { title: 'test', start_at: '2026-10-01T10:00Z', end_at: '2026-10-01T09:00Z' }));
  assert.doesNotThrow(() => validateInput('tasks', baseTask));
});
