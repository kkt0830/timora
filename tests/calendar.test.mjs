import test from 'node:test';
import assert from 'node:assert/strict';
import { periodDays, shiftPeriod } from '../src/domain/calendar.ts';
test('day/week navigation preserves local calendar dates across DST and year boundaries',()=>{
 const before=process.env.TZ;
 try { for (const zone of ['Asia/Seoul','America/New_York','UTC']) {
  process.env.TZ=zone;
  assert.equal(shiftPeriod('2024-03-09','day',1),'2024-03-10');
  assert.equal(shiftPeriod('2024-03-09','week',1),'2024-03-16');
  assert.deepEqual(periodDays('2024-12-31','week'),['2024-12-29','2024-12-30','2024-12-31','2025-01-01','2025-01-02','2025-01-03','2025-01-04']);
  assert.equal(shiftPeriod('2024-01-31','month',1),'2024-02-01');
  assert.deepEqual(periodDays('2024-02-29','day'),['2024-02-29']);
  assert.equal(periodDays('2024-02-29','month').length,42);
 }} finally {if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
});
