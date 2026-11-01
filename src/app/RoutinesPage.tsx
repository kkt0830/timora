import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { EntityInput, Routine } from '../domain/models';
import { dateInZone, occurrences } from '../domain/recurrence';
import { routineRule } from '../domain/routines';
import { messageOf, useWorkspace } from './providers';
import { Dialog, PageTitle } from './components';
const frequencies = {daily:'매일',weekdays:'평일',weekly:'매주',monthly:'매월',yearly:'매년'};
export function RoutinesPage({ compact = false }: { compact?: boolean }) {
  const { data, save, busy } = useWorkspace();
  const [editing, setEditing] = useState<Routine | 'new' | null>(null), [error, setError] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const [history, setHistory] = useState<string | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  const rows = data.routines.filter(r => r.status !== 'archived').map(r => {
    try { const day = dateInZone(clock,r.timezone); return {routine:r,day,scheduled:occurrences(routineRule(r),day,day).length>0,invalid:false}; }
    catch { return {routine:r,day:'',scheduled:false,invalid:true}; }
  });
  const scheduled = rows.filter(r=>r.scheduled);
  const done = scheduled.filter(r=>data.routine_completions.some(c=>c.routine_id===r.routine.id && c.local_date===r.day && c.status==='done')).length;
  async function action(fn:()=>Promise<void>) { setError(''); try {await fn();} catch(e){setError(messageOf(e));} }
  if (!data.routines_available) return compact ? null : <><PageTitle title="Routines" eyebrow="DAILY" description="나의 일정에 맞춰 반복하는 작은 습관" /><p>루틴을 사용하려면 Cloud 서버 업데이트가 필요합니다.</p></>;
  return <section className="routine-section">
    {!compact && <PageTitle title="Routines" eyebrow="DAILY" description="완료 기록은 날짜별로 보관됩니다. 쉬어 가도 괜찮아요." action="새 루틴" onAction={()=>setEditing('new')} />}
    <h2>오늘의 루틴 · {done}/{scheduled.length}</h2><p>남은 루틴 {scheduled.length-done}개 · {scheduled.length ? Math.round(done/scheduled.length*100) : 0}%</p>
    {error && <p role="alert" className="error">{error}</p>}
    {(compact ? scheduled : rows).map(({routine:r,day,scheduled,invalid})=>{
      const completed=data.routine_completions.find(c=>c.routine_id===r.id&&c.local_date===day);
      return <article className="card routine-card" key={r.id}><h3>{r.title}</h3><p>{r.description}</p><small>{frequencies[r.frequency]} · {r.timezone} · {r.status==='paused'?'일시정지':day}{!scheduled?' · 오늘 일정 없음':''}</small>
        {invalid && <p role="alert">반복 일정이나 시간대를 확인해 주세요.</p>}
        {scheduled && <button disabled={busy} type="button" aria-pressed={completed?.status==='done'} onClick={()=>void action(()=>save('routine_completions',{routine_id:r.id,local_date:day,status:completed?.status==='done'?'todo':'done'},completed?.id))}>{completed?.status==='done'?'완료 취소':'오늘 완료'}</button>}
        {!compact && <div className="period-filters"><button type="button" onClick={()=>setEditing(r)}>수정</button><button type="button" disabled={busy} onClick={()=>void action(()=>save('routines',{...r,status:r.status==='paused'?'active':'paused'},r.id))}>{r.status==='paused'?'다시 시작':'일시정지'}</button><button type="button" onClick={()=>setHistory(history===r.id?null:r.id)}>완료 이력</button><button type="button" disabled={busy} onClick={()=>{if(window.confirm('이 루틴을 보관할까요? 과거 완료 기록은 유지됩니다.'))void action(()=>save('routines',{...r,status:'archived'},r.id));}}>보관</button></div>}
        {history===r.id && <ul>{data.routine_completions.filter(c=>c.routine_id===r.id).sort((a,b)=>b.local_date.localeCompare(a.local_date)).map(c=><li key={c.id}>{c.local_date} · {c.status==='done'?'완료':'미완료'}</li>)}</ul>}
      </article>;
    })}
    {!compact && <details><summary>보관한 루틴</summary>{data.routines.filter(r=>r.status==='archived').map(r=><div key={r.id}>{r.title}<button disabled={busy} onClick={()=>void action(()=>save('routines',{...r,status:'paused'},r.id))}>복구</button><ul>{data.routine_completions.filter(c=>c.routine_id===r.id).sort((a,b)=>b.local_date.localeCompare(a.local_date)).map(c=><li key={c.id}>{c.local_date} · {c.status==='done'?'완료':'미완료'}</li>)}</ul></div>)}</details>}
    {editing && <RoutineEditor key={editing==='new'?'new':editing.id} routine={editing==='new'?undefined:editing} onClose={()=>setEditing(null)} />}
  </section>;
}
function RoutineEditor({routine:r,onClose}:{routine?:Routine;onClose:()=>void}) {
  const {save,busy}=useWorkspace();const [error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const text=(key:string)=>String(f.get(key)??'');setError('');
    const input:EntityInput<'routines'>={title:text('title').trim(),description:text('description'),frequency:text('frequency') as Routine['frequency'],interval_days:Number(text('interval_days')),start_date:text('start_date'),end_date:text('end_date')||null,occurrence_limit:text('occurrence_limit')?Number(text('occurrence_limit')):null,weekdays:f.getAll('weekdays').map(String).join(','),timezone:text('timezone'),status:r?.status??'active',reminder_time:text('reminder_time')||null,category:text('category')};
    try{await save('routines',input,r?.id);onClose();}catch(e){setError(messageOf(e));}}
  return <Dialog title={r?'루틴 수정':'새 루틴'} busy={busy} onClose={onClose}><form onSubmit={submit}><fieldset disabled={busy}>
    <label>이름<input name="title" required maxLength={300} defaultValue={r?.title??''}/></label><label>설명<textarea name="description" maxLength={20000} defaultValue={r?.description??''}/></label>
    <div className="form-grid"><label>반복<select name="frequency" defaultValue={r?.frequency??'daily'}>{Object.entries(frequencies).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>반복 간격<input name="interval_days" type="number" min={1} max={366} required defaultValue={r?.interval_days??1}/></label></div>
    <small>매일은 N일, 매주는 N주, 매월은 N개월 간격입니다. 매월 31일처럼 없는 날짜는 건너뜁니다.</small>
    <fieldset><legend>매주 반복할 요일 (미선택 시 시작일 요일)</legend>{['일','월','화','수','목','금','토'].map((d,i)=><label key={d} style={{display:'inline-flex',marginRight:12}}><input type="checkbox" name="weekdays" value={i} defaultChecked={r?.weekdays.split(',').includes(String(i))??false}/>{d}</label>)}</fieldset>
    <div className="form-grid"><label>시작일<input name="start_date" type="date" required defaultValue={r?.start_date??dateInZone(new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone)}/></label><label>종료일<input name="end_date" type="date" defaultValue={r?.end_date??''}/></label></div>
    <label>최대 반복 횟수<input name="occurrence_limit" type="number" min={1} max={10000} defaultValue={r?.occurrence_limit??''}/></label><label>시간대<input name="timezone" required maxLength={64} defaultValue={r?.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone}/></label><label>분류<input name="category" maxLength={100} defaultValue={r?.category??''}/></label><label>선호 알림 시간<input name="reminder_time" type="time" defaultValue={r?.reminder_time??''}/></label><small>알림 시간은 저장됩니다. 기기 알림 예약 기능은 아직 연결되지 않았습니다.</small>
    {error&&<p role="alert" className="error">{error}</p>}<div className="dialog-actions"><button type="button" onClick={onClose}>취소</button><button type="submit">저장</button></div>
  </fieldset></form></Dialog>;
}
