import { performance } from 'node:perf_hooks';
import { emptyWorkspace } from '../src/domain/models.ts';
import { searchWorkspace } from '../src/domain/search.ts';
import { indexCalendar } from '../src/domain/calendar.ts';
import { taskGroup } from '../src/domain/task-groups.ts';
import { eventOnDay, monthDays, dateKey } from '../src/domain/dates.ts';
const rounds=9;
function measure(fn){const values=[];for(let i=0;i<rounds;i++){const start=performance.now();fn();values.push(performance.now()-start);}values.sort((a,b)=>a-b);return {median_ms:+values[4].toFixed(2),p95_ms:+values[8].toFixed(2)};}
const results=[];
for(const size of [100,1000,10000]){
 const data=emptyWorkspace('fixture');const stamp='2026-11-01T00:00:00Z';
 for(let i=0;i<Math.max(1,size/100);i++)data.projects.push({id:`p${i}`,user_id:'fixture',created_at:stamp,updated_at:stamp,name:`Project ${i}`,description:'',status:'active',color:'#5271ff'});
 for(let i=0;i<20;i++)data.tags.push({id:`tag${i}`,name:`tag ${i}`,color:'#5271ff'});
 for(let i=0;i<size;i++){const base={id:`item${i}`,user_id:'fixture',created_at:stamp,updated_at:stamp,title:`Fixture item ${i}`,project_id:data.projects[i%data.projects.length].id};
 if(i%3===0)data.tasks.push({...base,description:'benchmark source',status:'todo',priority:'medium',start_date:null,due_date:`2026-11-${String(i%28+1).padStart(2,'0')}`});
 else if(i%3===1){data.notes.push({...base,content:'Synthetic searchable content '.repeat(20)});data.note_tags.push({id:`link${i}`,note_id:base.id,tag_id:`tag${i%20}`});}
 else data.events.push({...base,description:'',start_at:`2026-11-${String(i%28+1).padStart(2,'0')}T09:00:00Z`,end_at:`2026-11-${String(i%28+1).padStart(2,'0')}T10:00:00Z`});}
 const days=monthDays(new Date(2026,10,1)).map(dateKey);
 results.push({objects:size,search:measure(()=>searchWorkspace(data,'searchable tag')),grouping:measure(()=>data.tasks.map(t=>taskGroup(t,'2026-11-02'))),calendar_buckets:measure(()=>indexCalendar(data.events,data.tasks,days)),snapshot_bytes:Buffer.byteLength(JSON.stringify(data))});
}
console.log(JSON.stringify({runtime:process.version,scope:'Synthetic domain operations only; not device startup/render/network/heap acceptance',rounds,results},null,2));
