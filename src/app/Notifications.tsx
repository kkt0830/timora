import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { isPermissionGranted, requestPermission, pending, cancel, cancelAll, onAction, registerActionTypes, Schedule } from '@tauri-apps/plugin-notification';
import { reminderDefaults, reminderIntents } from '../domain/reminders';
import type { ReminderPreferences } from '../domain/reminders';
import { isAndroid, isNative } from '../services/runtime';
import { messageOf, useAuth, useWorkspace } from './providers';
import { PageTitle } from './components';
function read(key:string):ReminderPreferences{try{const v=JSON.parse(localStorage.getItem(key)??'null');if(v&&typeof v.enabled==='boolean'&&typeof v.taskStart==='boolean'&&typeof v.taskDue==='boolean'&&typeof v.events==='boolean'&&typeof v.routines==='boolean'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v.startTime)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v.dueTime)&&Number.isInteger(v.eventMinutes)&&v.eventMinutes>=0&&v.eventMinutes<=10080&&Array.isArray(v.disabled))return {...v,disabled:v.disabled.filter((x:unknown)=>typeof x==='string').slice(0,10000)};}catch{}return reminderDefaults;}
function usePreferences(){const {account}=useAuth();const key=`timora:reminders:${account!.id}`;const [value,setValue]=useState(()=>read(key));useEffect(()=>{const changed=()=>setValue(read(key));window.addEventListener('timora:reminders',changed);window.addEventListener('storage',changed);return()=>{window.removeEventListener('timora:reminders',changed);window.removeEventListener('storage',changed);};},[key]);function update(v:ReminderPreferences){localStorage.setItem(key,JSON.stringify(v));setValue(v);window.dispatchEvent(new Event('timora:reminders'));}return {key,value,update};}
let deliveryQueue=Promise.resolve();let generation=0;
export function NotificationScheduler(){
 const {data,loaded}=useWorkspace();const {key,value}=usePreferences();const navigate=useNavigate();const [tick,setTick]=useState(0),[error,setError]=useState('');
 useEffect(()=>{if(!isNative)return;const timer=window.setInterval(()=>setTick(n=>n+1),30000);let alive=true;let remove:(()=>void)|undefined;
  void registerActionTypes([{id:'timora-open',actions:[{id:'open',title:'열기'}]}]).then(()=>onAction(event=>{try{const states=JSON.parse(localStorage.getItem(`${key}:scheduled`)??'{}');const path=states[event.notification?.id??0]?.path;if(typeof path==='string'&&/^\/(tasks\?object=[0-9a-f-]+|calendar\?object=[0-9a-f-]+|routines)$/.test(path))navigate(path);}catch{}})).then(listener=>{if(alive)remove=()=>void listener.unregister();else void listener.unregister();}).catch(e=>setError(messageOf(e)));
  return()=>{alive=false;window.clearInterval(timer);remove?.();generation++;deliveryQueue=deliveryQueue.then(()=>cancelAll()).catch(()=>{});};
 },[key,navigate]);
 useEffect(()=>{if(!isNative||!loaded)return;const current=++generation;let alive=true;
  deliveryQueue=deliveryQueue.then(async()=>{if(current!==generation)return;if(!value.enabled){await cancelAll();localStorage.removeItem(`${key}:scheduled`);return;}if(!await isPermissionGranted())throw new Error('알림 권한이 없습니다. Notifications에서 권한을 확인해 주세요.');
   const intents=reminderIntents(data,value,Date.now(),Intl.DateTimeFormat().resolvedOptions().timeZone);let states:Record<string,{fingerprint:string;path:string;at:number}>={};try{states=JSON.parse(localStorage.getItem(`${key}:scheduled`)??'{}');}catch{}
   const scheduled=isAndroid?await pending():[];const pendingIds=new Set(scheduled.map(n=>n.id));const wanted=new Set(intents.map(n=>n.id));if(isAndroid){const obsolete=scheduled.filter(n=>!wanted.has(n.id)).map(n=>n.id);if(obsolete.length)await cancel(obsolete);}
   for(const intent of intents){if(current!==generation)return;const fingerprint=JSON.stringify(intent);const previous=states[intent.id];
    if(isAndroid){if(intent.at<=Date.now())continue;if(previous?.fingerprint===fingerprint&&pendingIds.has(intent.id))continue;if(pendingIds.has(intent.id))await cancel([intent.id]);}
    else {if(intent.at>Date.now()||previous?.fingerprint===fingerprint)continue;}
    await invoke('plugin:notification|notify',{options:{id:intent.id,title:'Timora',body:intent.title,actionTypeId:'timora-open',schedule:isAndroid?Schedule.at(new Date(intent.at)):undefined}});
    states[intent.id]={fingerprint,path:intent.path,at:intent.at};localStorage.setItem(`${key}:scheduled`,JSON.stringify(states));
   }
   states=Object.fromEntries(Object.entries(states).filter(([,v])=>v.at>Date.now()-86400000).slice(-256));localStorage.setItem(`${key}:scheduled`,JSON.stringify(states));if(alive)setError('');
  }).catch(e=>{if(alive)setError(messageOf(e));});return()=>{alive=false;};
 },[data,loaded,value,key,tick]);
 return error?<p role="alert">알림 예약: {error}</p>:null;
}
export function NotificationsPage(){const {data}=useWorkspace();const {value,update}=usePreferences();const [permission,setPermission]=useState('확인 중'),[error,setError]=useState('');useEffect(()=>{if(!isNative){setPermission('Native 앱에서 지원');return;}void isPermissionGranted().then(v=>setPermission(v?'허용됨':'허용되지 않음')).catch(e=>setError(messageOf(e)));},[]);
 async function enable(){try{const granted=await isPermissionGranted()||await requestPermission()==='granted';setPermission(granted?'허용됨':'허용되지 않음');if(granted)update({...value,enabled:true});}catch(e){setError(messageOf(e));}}
 function change(v:ReminderPreferences){try{update(v);}catch(e){setError(messageOf(e));}}
 const items=[...data.tasks.map(t=>({id:`task:${t.id}`,title:t.title})),...data.events.map(e=>({id:`event:${e.id}`,title:e.title})),...data.routines.map(r=>({id:`routine:${r.id}`,title:r.title}))];
 return <><PageTitle title="Notifications" eyebrow="REMIND" description="이 기기에서 받을 알림을 직접 선택하세요."/><section className="card"><p>권한: {permission}</p><button disabled={!isNative} onClick={()=>value.enabled?change({...value,enabled:false}):void enable()}>{value.enabled?'알림 끄기':'권한 확인·알림 켜기'}</button>{(['taskStart','taskDue','events','routines'] as const).map(k=><label key={k}><input type="checkbox" checked={value[k]} onChange={e=>change({...value,[k]:e.target.checked})}/>{{taskStart:'Task 시작',taskDue:'Task 마감',events:'일정 시작 전',routines:'루틴의 선호 알림 시간'}[k]}</label>)}<label>Task 시작 시각<input type="time" value={value.startTime} onChange={e=>e.target.value&&change({...value,startTime:e.target.value})}/></label><label>Task 마감 시각<input type="time" value={value.dueTime} onChange={e=>e.target.value&&change({...value,dueTime:e.target.value})}/></label><label>일정 몇 분 전<input type="number" min={0} max={10080} value={value.eventMinutes} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=10080)change({...value,eventMinutes:n});}}/></label><p>설정·기기 예약 상태는 이 기기에 보관합니다. Android는 앞으로 7일 이내 최대 64개를 OS에 예약하고 앱을 다시 열면 재확인합니다. 배터리 제한·재부팅·권한 변경에 따라 전달이 지연되거나 재예약이 필요할 수 있습니다. Windows는 앱 실행 중에 도래한 알림만 전달합니다. 앱 종료 중 Windows 전달은 지원하지 않습니다.</p><p>Task·일정은 기기 시간대, 루틴은 루틴에 지정한 시간대를 사용합니다. 완료·삭제·일시정지 변경은 앱에서 확인한 뒤 예약에 반영됩니다.</p>{error&&<p role="alert">{error}</p>}</section><details className="card"><summary>항목별 알림</summary>{items.map(item=><label key={item.id}><input type="checkbox" checked={!value.disabled.includes(item.id)} onChange={e=>change({...value,disabled:e.target.checked?value.disabled.filter(id=>id!==item.id):[...value.disabled,item.id]})}/>{item.title}</label>)}</details></>;
}
