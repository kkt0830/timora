import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { TaskRecurrence } from '../domain/models';
import { dateInZone, occurrences } from '../domain/recurrence';
import { routineRule } from '../domain/routines';
import { RoutineEditor } from './RoutinesPage';
import { messageOf, useWorkspace } from './providers';
import { PageTitle } from './components';

/** Generates today only. Missed dates are explicitly selected, never an unbounded backlog. */
export function RecurringTaskScheduler() {
 const {data,busy,loaded,generateTasks}=useWorkspace();const [tick,setTick]=useState(0),[error,setError]=useState('');const flight=useRef(false);const attempts=useRef(new Map<string,number>());
 useEffect(()=>{const timer=window.setInterval(()=>setTick(n=>n+1),60000);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{
  if(!loaded||busy||!data.recurrence_available||flight.current)return;
  for(const rule of data.task_recurrences){
   if(rule.status!=='active')continue;
   try {const day=dateInZone(new Date(),rule.timezone);const key=`${rule.id}:${rule.updated_at}:${day}`;
    if(data.task_occurrences.some(o=>o.recurrence_id===rule.id&&o.local_date===day)||occurrences(routineRule(rule),day,day).length===0||(attempts.current.get(key)??-1)===tick)continue;
    attempts.current.set(key,tick);flight.current=true;
    void generateTasks(rule.id,rule.updated_at,[day]).then(()=>setError('')).catch(e=>setError(messageOf(e))).finally(()=>{flight.current=false;});break;
   }catch(e){setError(messageOf(e));}
  }
 },[data,busy,loaded,tick,generateTasks]);
 return error?<p role="alert">오늘의 반복 작업 생성 대기: {error} <NavLink to="/recurring">반복 작업 확인</NavLink></p>:null;
}
export function RecurringTasksPage(){
 const {data,busy,save,generateTasks}=useWorkspace();const [editing,setEditing]=useState<TaskRecurrence|'new'|null>(null),[error,setError]=useState('');
 const [from,setFrom]=useState(()=>dateInZone(new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone));const [through,setThrough]=useState(from);
 async function action(fn:()=>Promise<void>){setError('');try{await fn();}catch(e){setError(messageOf(e));}}
 async function generate(r:TaskRecurrence){const span=(Date.parse(through)-Date.parse(from))/86400000;if(!Number.isFinite(span)||span<0||span>30)throw new Error('한 번에 최대 31일을 선택해 주세요.');const days=occurrences(routineRule(r),from,through).filter(day=>!data.task_occurrences.some(o=>o.recurrence_id===r.id&&o.local_date===day));if(days.length)await generateTasks(r.id,r.updated_at,days);}
 return <><PageTitle title="Recurring Tasks" eyebrow="REPEAT" description="매일의 작업은 독립된 회차로 생성됩니다. 완료 상태는 Tasks에서 변경하세요." action={data.recurrence_available?'새 반복 작업':undefined} onAction={()=>setEditing('new')}/>{!data.recurrence_available?<p>반복 작업은 Cloud 서버 업데이트 후 사용할 수 있습니다.</p>:<><p>앱을 열면 각 시간대의 오늘 회차를 만듭니다. 놓친 날짜나 미래 회차는 아래에서 최대 31일씩 생성할 수 있습니다.</p><div className="form-grid"><label>생성 시작일<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>생성 종료일<input type="date" value={through} onChange={e=>setThrough(e.target.value)}/></label></div>{error&&<p role="alert">{error}</p>}{data.task_recurrences.map(r=><article className="card" key={r.id}><h2>{r.title}</h2><p>{r.description}</p><p>{r.timezone} · {r.status==='active'?'사용 중':r.status==='paused'?'일시정지':'보관됨'}</p><div className="period-filters"><button type="button" onClick={()=>setEditing(r)}>규칙 수정</button><button type="button" disabled={busy||r.status!=='active'} onClick={()=>void action(()=>generate(r))}>선택 기간 회차 생성</button><button type="button" disabled={busy} onClick={()=>void action(()=>save('task_recurrences',{...r,status:r.status==='active'?'paused':'active'},r.id))}>{r.status==='active'?'일시정지':'다시 시작'}</button>{r.status!=='archived'&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('반복을 종료하고 보관할까요? 생성한 작업과 이력은 남습니다.'))void action(()=>save('task_recurrences',{...r,status:'archived'},r.id));}}>반복 종료·보관</button>}</div><details><summary>회차 이력</summary><ul>{data.task_occurrences.filter(o=>o.recurrence_id===r.id).sort((a,b)=>b.local_date.localeCompare(a.local_date)).map(o=>{const task=data.tasks.find(t=>t.id===o.task_id);return <li key={o.id}><NavLink to={`/tasks?object=${o.task_id}`}>{o.local_date} · {task?.title??'작업 확인'} · {task?.status==='done'?'완료':'미완료'}</NavLink></li>;})}</ul><p>이력을 보존하기 위해 생성한 회차 작업은 개별 완료 상태로 관리합니다.</p></details></article>)}{editing&&<RoutineEditor recurring key={editing==='new'?'new':editing.id} routine={editing==='new'?undefined:editing} onClose={()=>setEditing(null)}/>}</>}</>;
}
