import { useState } from 'react';
import type { FormEvent } from 'react';
import type { TaskBlock } from '../domain/models';
import { localDateTime, formatInstant } from '../domain/dates';
import { eventOnDay } from '../domain/dates';
import { messageOf, useWorkspace } from './providers';
import type { OpenEditor } from './rows';
function BlockForm({ day, taskId, block, done }: { day:string; taskId?:string; block?:TaskBlock; done?:()=>void }) {
 const {data,save,remove,busy}=useWorkspace();const [error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');const v=new FormData(e.currentTarget);try{const start=new Date(String(v.get('start_at')));const end=new Date(String(v.get('end_at')));if(!Number.isFinite(+start)||!Number.isFinite(+end))throw new Error('시작·종료 시간을 입력해 주세요.');await save('task_blocks',{task_id:String(v.get('task_id')),start_at:start.toISOString(),end_at:end.toISOString()},block?.id);done?.();}catch(e){setError(messageOf(e));}}
 return <form onSubmit={e=>void submit(e)}><label>시간을 배정할 작업<select name="task_id" required defaultValue={block?.task_id??taskId??''}><option value="" disabled>작업 선택</option>{data.tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><div className="form-grid"><label>블록 시작<input name="start_at" type="datetime-local" required defaultValue={block?localDateTime(block.start_at):`${day}T09:00`}/></label><label>블록 종료<input name="end_at" type="datetime-local" required defaultValue={block?localDateTime(block.end_at):`${day}T10:00`}/></label></div><p>기기 시간대 {Intl.DateTimeFormat().resolvedOptions().timeZone}로 입력합니다. 시간을 변경하면 블록을 이동하거나 길이를 조정할 수 있습니다.</p><button disabled={busy}>시간 블록 저장</button>{block&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('이 시간 블록을 삭제할까요? 작업은 남습니다.'))void remove('task_blocks',block.id).then(done).catch(e=>setError(messageOf(e)));}}>시간 블록 삭제</button>}{error&&<p role="alert">{error}</p>}</form>;
}
export function TimeBlocks({day,open}:{day:string;open:OpenEditor}){
 const {data}=useWorkspace();const [editing,setEditing]=useState<string|null>(null);
 if(!data.tools_available)return <p>시간 블록은 Cloud 서버 업데이트 후 사용할 수 있습니다.</p>;
 const blocks=data.task_blocks.filter(b=>eventOnDay(b,day)).sort((a,b)=>a.start_at.localeCompare(b.start_at)||a.id.localeCompare(b.id));
 return <section className="card"><h2>{day} 시간 블록</h2><details><summary>작업에 시간 배정</summary><BlockForm key={day} day={day}/></details>{blocks.map(b=>{
 const task=data.tasks.find(t=>t.id===b.task_id);const overlaps=blocks.filter(other=>other.id!==b.id&&Date.parse(other.start_at)<Date.parse(b.end_at)&&Date.parse(other.end_at)>Date.parse(b.start_at)).length+data.events.filter(e=>Date.parse(e.start_at)<Date.parse(b.end_at)&&Date.parse(e.end_at)>Date.parse(b.start_at)).length;
 return <article key={b.id} className="card"><button type="button" className="row-title" disabled={!task} onClick={()=>task&&open({table:'tasks',item:task})}>{task?.title??'연결 작업 확인 필요'}</button><p>{formatInstant(b.start_at)} – {formatInstant(b.end_at)}</p>{overlaps>0&&<p role="status">다른 일정·블록 {overlaps}개와 시간이 겹칩니다.</p>}<button type="button" aria-expanded={editing===b.id} onClick={()=>setEditing(editing===b.id?null:b.id)}>시간 이동·길이 수정</button>{editing===b.id&&<BlockForm day={day} block={b} done={()=>setEditing(null)}/>}</article>;
 })}</section>;
}
