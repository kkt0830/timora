import type { WorkspaceData } from './models.ts';
import { dateInZone, occurrences } from './recurrence.ts';
import { routineRule } from './routines.ts';
export interface ReminderPreferences { enabled:boolean; taskStart:boolean; taskDue:boolean; events:boolean; routines:boolean; startTime:string; dueTime:string; eventMinutes:number; disabled:string[] }
export const reminderDefaults:ReminderPreferences={enabled:false,taskStart:true,taskDue:true,events:false,routines:true,startTime:'09:00',dueTime:'18:00',eventMinutes:15,disabled:[]};
export interface ReminderIntent { key:string; id:number; at:number; title:string; path:string }
/** Resolve an IANA local wall clock. A nonexistent DST time is skipped. */
export function zonedTime(day:string,time:string,zone:string):number|null {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
 const wanted=Date.parse(`${day}T${time}:00Z`);let guess=wanted;
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(let i=0;i<4;i++){const parts=formatter.formatToParts(new Date(guess));const p=(key:string)=>parts.find(p=>p.type===key)!.value;const local=`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:00Z`;const actual=Date.parse(local);if(actual===wanted)return guess;guess+=wanted-actual;}return null;
}
export function reminderIntents(data:WorkspaceData,p:ReminderPreferences,now:number,zone:string):ReminderIntent[]{
 const items:Omit<ReminderIntent,'id'>[]=[];const end=now+7*86400000;
 const add=(key:string,at:number|null,title:string,path:string)=>{if(at!==null&&Number.isFinite(at)&&at>now-60000&&at<=end&&!p.disabled.includes(key.split(':')[0]+':'+key.split(':')[1]))items.push({key,at,title,path});};
 for(const t of data.tasks){if(t.status==='done')continue;if(p.taskStart&&t.start_date)add(`task:${t.id}:start`,zonedTime(t.start_date,p.startTime,zone),`${t.title} · 시작`,`/tasks?object=${t.id}`);if(p.taskDue&&t.due_date)add(`task:${t.id}:due`,zonedTime(t.due_date,p.dueTime,zone),`${t.title} · 마감`,`/tasks?object=${t.id}`);}
 if(p.events)for(const e of data.events)add(`event:${e.id}:start`,Date.parse(e.start_at)-p.eventMinutes*60000,e.title,`/calendar?object=${e.id}`);
 if(p.routines)for(const r of data.routines){if(!r.reminder_time||r.status!=='active')continue;const from=dateInZone(new Date(now),r.timezone),through=dateInZone(new Date(end),r.timezone);for(const day of occurrences(routineRule(r),from,through)){if(data.routine_completions.some(c=>c.routine_id===r.id&&c.local_date===day&&c.status==='done'))continue;add(`routine:${r.id}:${day}`,zonedTime(day,r.reminder_time,r.timezone),r.title,'/routines');}}
 const used=new Set<number>();return items.sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key)).slice(0,64).map(item=>{let hash=2166136261;for(const c of item.key)hash=Math.imul(hash^c.charCodeAt(0),16777619);let id=(hash>>>0)%2147483646+1;while(used.has(id))id=id%2147483646+1;used.add(id);return {...item,id};});
}
