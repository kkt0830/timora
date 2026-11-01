import test from 'node:test';
import assert from 'node:assert/strict';
import { occurrences, dateInZone } from '../src/domain/recurrence.ts';
const base={id:'rule',frequency:'daily',interval:1,start:'2024-02-28',end:null,limit:null,weekdays:[],timezone:'Asia/Seoul',paused:false};
test('recurrence keeps date-only leap days and global occurrence limits across query windows',()=>{
 assert.deepEqual(occurrences(base,'2024-02-28','2024-03-01'),['2024-02-28','2024-02-29','2024-03-01']);
 assert.deepEqual(occurrences({...base,limit:2},'2024-03-01','2024-03-04'),[]);
 assert.deepEqual(occurrences({...base,paused:true},base.start,'2024-03-01'),[]);
});
test('month-end and yearly leap recurrence skip invalid dates; custom interval remains anchored',()=>{
 assert.deepEqual(occurrences({...base,frequency:'monthly',start:'2024-01-31'},'2024-01-01','2024-04-30'),['2024-01-31','2024-03-31']);
 assert.deepEqual(occurrences({...base,frequency:'yearly',start:'2024-02-29'},'2024-01-01','2028-03-01'),['2024-02-29','2028-02-29']);
 assert.deepEqual(occurrences({...base,interval:2},base.start,'2024-03-03'),['2024-02-28','2024-03-01','2024-03-03']);
});
test('weekly selected weekdays and DST use calendar dates, with bounded generation',()=>{
 assert.deepEqual(occurrences({...base,frequency:'weekly',weekdays:[1,5],start:'2024-03-04',timezone:'America/New_York'},'2024-03-04','2024-03-15'),['2024-03-04','2024-03-08','2024-03-11','2024-03-15']);
 assert.equal(dateInZone(new Date('2024-03-10T04:30:00Z'),'America/New_York'),'2024-03-09');
 assert.throws(()=>occurrences(base,'2024-01-01','2026-01-01'));
 assert.throws(()=>occurrences({...base,start:'2024-02-30'},base.start,'2024-03-01'));
});
