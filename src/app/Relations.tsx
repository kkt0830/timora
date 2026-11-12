import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { EntityTable, ObjectKind, RelationKind } from '../domain/models';
import { useWorkspace, messageOf } from './providers';
export const objectKinds:Partial<Record<EntityTable,ObjectKind>>={tasks:'task',notes:'note',projects:'project',events:'event',library_items:'resource'};
const paths:Record<ObjectKind,string>={task:'tasks',note:'notes',project:'projects',event:'calendar',resource:'library'};
const labels:Record<RelationKind,string>={references:'참조',belongs_to:'소속',depends_on:'의존'};
export function Relations({id,kind}:{id:string;kind:ObjectKind}){
 const {data,save,remove,busy}=useWorkspace();const [query,setQuery]=useState(''),[target,setTarget]=useState(''),[relation,setRelation]=useState<RelationKind>('references'),[error,setError]=useState('');
 if(!data.extras_available)return null;
 const objects=Object.entries(objectKinds).flatMap(([table,k])=>data[table as 'tasks'|'notes'|'projects'|'events'|'library_items'].map(row=>({id:row.id,kind:k!,title:'name'in row?row.name:row.title}))).filter(row=>row.id!==id||row.kind!==kind);
 const targets=objects.filter(o=>o.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,100);
 async function add(){setError('');const obj=objects.find(o=>`${o.kind}:${o.id}`===target);if(!obj){setError('연결할 대상을 선택해 주세요.');return;}try{await save('object_relations',{source_id:id,source_kind:kind,target_id:obj.id,target_kind:obj.kind,kind:relation});setTarget('');}catch(e){setError(messageOf(e));}}
 function links(incoming:boolean){const rows=data.object_relations.filter(r=>incoming?r.target_id===id&&r.target_kind===kind:r.source_id===id&&r.source_kind===kind);return <ul>{rows.map(r=>{const oid=incoming?r.source_id:r.target_id,okind=incoming?r.source_kind:r.target_kind;const obj=objects.find(o=>o.id===oid&&o.kind===okind);const path=okind==='project'?`/projects/${oid}`:`/${paths[okind]}?object=${oid}`;return <li key={r.id}>{labels[r.kind]} · <NavLink to={path}>{obj?.title??'연결 대상'}</NavLink><button type="button" disabled={busy} onClick={()=>void remove('object_relations',r.id).catch(e=>setError(messageOf(e)))}>연결 해제</button></li>;})}</ul>;}
 return <details><summary>관련 항목·역참조</summary><h3>이 항목에서 연결</h3>{links(false)}<h3>이 항목을 가리키는 연결</h3>{links(true)}<label>연결 대상 검색<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setTarget('');}}/></label><label>연결 대상<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">대상 선택</option>{targets.map(o=><option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>{o.title} · {o.kind}</option>)}</select></label><label>관계 종류<select value={relation} onChange={e=>setRelation(e.target.value as RelationKind)}>{Object.entries(labels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><button type="button" disabled={busy||!target} onClick={()=>void add()}>관계 추가</button><p>의존은 순환 연결을 허용하지 않습니다. 항목을 삭제하면 연결도 제거됩니다. 소속 관계는 프로젝트 필드를 자동 변경하지 않습니다.</p>{error&&<p role="alert">{error}</p>}</details>;
}
