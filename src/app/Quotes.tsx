import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { bundledQuotes, dailyQuote } from '../domain/quotes';
import type { QuoteMode, QuoteText } from '../domain/quotes';
import type { UserQuote } from '../domain/models';
import { dateKey } from '../domain/dates';
import { PageTitle } from './components';
import { messageOf, useAuth, useWorkspace } from './providers';
interface Preferences { mode:QuoteMode; enabled:boolean; favorites:string[] }
const defaults:Preferences={mode:'mixed',enabled:true,favorites:[]};
function preferences(key:string):Preferences {try{const v=JSON.parse(localStorage.getItem(key)??'null');return v&&['mixed','bundled','personal'].includes(v.mode)&&typeof v.enabled==='boolean'&&Array.isArray(v.favorites)?{mode:v.mode,enabled:v.enabled,favorites:v.favorites.filter((s:unknown)=>typeof s==='string').slice(0,100)}:defaults;}catch{return defaults;}}
function useQuoteSettings(){const {account}=useAuth();const key=`timora:quotes:${account!.id}`;const [prefs,setPrefs]=useState(()=>preferences(key));const [error,setError]=useState('');function update(next:Preferences){try{localStorage.setItem(key,JSON.stringify(next));setPrefs(next);}catch{setError('이 기기에 문구 설정을 저장하지 못했습니다.');}}return {key,prefs,update,error};}
function selectToday(key:string,prefs:Preferences,user:UserQuote[]):QuoteText {
 const day=dateKey();let history:Record<string,QuoteText>={};
 try{const v=JSON.parse(localStorage.getItem(`${key}:history`)??'{}');if(v&&typeof v==='object'&&!Array.isArray(v))for(const [d,q]of Object.entries(v)){const t=q as QuoteText;if(/^\d{4}-\d{2}-\d{2}$/.test(d)&&t&&typeof t.id==='string'&&typeof t.content==='string'&&t.content.length<=2000&&typeof t.author==='string'&&t.author.length<=200)history[d]=t;}}catch{}
 if(history[day])return history[day];
 const previous=Object.keys(history).filter(d=>d<day).sort().at(-1);const selected=dailyQuote(day,prefs.mode,user,previous?history[previous].id:undefined);
 history[day]=selected;history=Object.fromEntries(Object.entries(history).sort(([a],[b])=>b.localeCompare(a)).slice(0,366));try{localStorage.setItem(`${key}:history`,JSON.stringify(history));}catch{/* deterministic fallback remains usable in memory */}return selected;
}
export function DailyQuote({launch=false}:{launch?:boolean}){
 const {data,loaded}=useWorkspace();const {key,prefs}=useQuoteSettings();const [quote,setQuote]=useState<QuoteText|null>(null),[visible,setVisible]=useState(!launch);const [day,setDay]=useState(dateKey);
 useEffect(()=>{const timer=window.setInterval(()=>setDay(dateKey()),30000);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{if(!loaded)return;setQuote(selectToday(key,prefs,data.user_quotes));if(launch){let seen=false;try{seen=localStorage.getItem(`${key}:seen`)===day;}catch{}setVisible(prefs.enabled&&!seen);if(prefs.enabled&&!seen)try{localStorage.setItem(`${key}:seen`,day);}catch{}}},[loaded,day,key]);
 if(!quote||!visible)return null;
 return <aside className="card daily-quote" aria-label="오늘의 문구"><h2>오늘의 문구</h2><blockquote>{quote.content}</blockquote><p>{quote.author||'내 문구'}</p><NavLink to="/quotes">문구·즐겨찾기 관리</NavLink>{launch&&<button type="button" onClick={()=>setVisible(false)}>문구 닫기</button>}</aside>;
}
function QuoteForm({quote}:{quote?:UserQuote}){
 const {save,remove,busy}=useWorkspace();const [error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setError('');try{await save('user_quotes',{content:String(f.get('content')).trim(),author:String(f.get('author')),favorite:quote?.favorite??0},quote?.id);if(!quote)form.reset();}catch(e){setError(messageOf(e));}}
 return <form onSubmit={e=>void submit(e)}><label>문구<textarea name="content" required maxLength={2000} defaultValue={quote?.content??''}/></label><label>작성자·출처<input name="author" maxLength={200} defaultValue={quote?.author??''}/></label><button disabled={busy}>{quote?'문구 저장':'문구 추가'}</button>{quote&&<><button type="button" disabled={busy} aria-pressed={quote.favorite===1} onClick={()=>void save('user_quotes',{...quote,favorite:quote.favorite?0:1},quote.id).catch(e=>setError(messageOf(e)))}>즐겨찾기 {quote.favorite?'해제':'추가'}</button><button type="button" disabled={busy} onClick={()=>{if(window.confirm('내 문구를 삭제할까요? 오늘 선택한 문구 기록은 유지됩니다.'))void remove('user_quotes',quote.id).catch(e=>setError(messageOf(e)));}}>문구 삭제</button></>}{error&&<p role="alert">{error}</p>}</form>;
}
export function QuotesPage(){
 const {data}=useWorkspace();const {prefs,update,error}=useQuoteSettings();const [favorites,setFavorites]=useState(false);
 return <><PageTitle title="Quotes" eyebrow="WORDS" description="매일 같은 문구를 간직하고, 나에게 남는 말을 기록하세요."/><DailyQuote/><section className="card"><label><input type="checkbox" checked={prefs.enabled} onChange={e=>update({...prefs,enabled:e.target.checked})}/>하루 첫 실행에 문구 표시</label><label>문구 출처<select value={prefs.mode} onChange={e=>update({...prefs,mode:e.target.value as QuoteMode})}><option value="mixed">Timora + 내 문구</option><option value="bundled">Timora 문구</option><option value="personal">내 문구</option></select></label><p>오늘 선택은 유지되며 출처 변경은 다음 날짜부터 적용됩니다. 내 문구가 없으면 Timora 문구를 보여줍니다. 표시 설정·선택 이력·Timora 즐겨찾기는 이 기기에 보관됩니다. 내 문구와 즐겨찾기는 Cloud 연결 시 동기화됩니다.</p>{error&&<p role="alert">{error}</p>}</section><label><input type="checkbox" checked={favorites} onChange={e=>setFavorites(e.target.checked)}/>즐겨찾기만 보기</label>{data.extras_available?<section className="card"><h2>내 문구</h2><QuoteForm/>{data.user_quotes.filter(q=>!favorites||q.favorite).map(q=><details key={q.id}><summary>{q.content}</summary><QuoteForm key={q.updated_at} quote={q}/></details>)}</section>:<p>내 문구 저장은 Cloud 서버 업데이트 후 사용할 수 있습니다.</p>}<section className="card"><h2>Timora 문구</h2>{bundledQuotes.filter(q=>!favorites||prefs.favorites.includes(q.id)).map(q=><article key={q.id}><p>{q.content}</p><button type="button" aria-pressed={prefs.favorites.includes(q.id)} onClick={()=>update({...prefs,favorites:prefs.favorites.includes(q.id)?prefs.favorites.filter(id=>id!==q.id):[...prefs.favorites,q.id]})}>즐겨찾기 {prefs.favorites.includes(q.id)?'해제':'추가'}</button></article>)}</section></>;
}
