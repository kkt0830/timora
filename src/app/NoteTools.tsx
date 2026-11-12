import { useState } from 'react';
import type { FormEvent } from 'react';
import { messageOf, useWorkspace } from './providers';
import type { NoteTemplate, Tag } from '../domain/models';

export const starterTemplates = {
  '일반 노트': '# 제목\n\n',
  '개발 기록': '## 목표\n\n## 작업 내용\n\n## 배운 점\n\n## 다음 작업\n',
  '독서 기록': '## 책\n\n## 핵심 내용\n\n## 나의 생각\n',
  '회의록': '## 참석자\n\n## 논의 내용\n\n## 결정 사항\n\n## 후속 작업\n',
};
export function TemplatePicker({ append }: { append: (content: string) => void }) {
  const { data } = useWorkspace();
  return <details><summary>템플릿 추가</summary><p>현재 내용 뒤에 추가합니다.</p><div className="period-filters">{Object.entries(starterTemplates).map(([name,content]) => <button type="button" key={name} onClick={() => append(content)}>{name}</button>)}{data.note_templates.map(t => <button type="button" key={t.id} onClick={() => append(t.content)}>{t.title} · 내 템플릿</button>)}</div></details>;
}
export function NoteTags({ noteId }: { noteId: string }) {
  const { data, save, remove, busy } = useWorkspace(); const [error,setError] = useState('');
  if (!data.tools_available) return null;
  async function toggle(tag: Tag) {
    setError(''); const link = data.note_tags.find(l => l.note_id === noteId && l.tag_id === tag.id);
    try { if (link) await remove('note_tags',link.id); else await save('note_tags',{note_id:noteId,tag_id:tag.id}); } catch(e) { setError(messageOf(e)); }
  }
  return <fieldset disabled={busy}><legend>태그 선택</legend>{data.tags.length ? <div className="period-filters">{data.tags.map(tag => <button type="button" key={tag.id} aria-pressed={data.note_tags.some(l=>l.note_id===noteId&&l.tag_id===tag.id)} onClick={()=>void toggle(tag)}><span aria-hidden="true" style={{color:tag.color}}>● </span>{tag.name}</button>)}</div> : <p>Notes의 태그·템플릿 관리에서 태그를 만들 수 있습니다.</p>}{error&&<p role="alert">{error}</p>}</fieldset>;
}
function TagForm({ tag }: { tag?: Tag }) {
  const { save,remove,busy } = useWorkspace(); const [error,setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault();const form=event.currentTarget;const values=new FormData(form);setError('');try{await save('tags',{name:String(values.get('name')).trim(),color:String(values.get('color'))},tag?.id);if(!tag)form.reset();}catch(e){setError(messageOf(e));} }
  return <form onSubmit={e=>void submit(e)}><div className="filters"><label>태그 이름<input name="name" defaultValue={tag?.name??''} maxLength={80} required /></label><label>태그 색상<input name="color" type="color" defaultValue={tag?.color??'#5271ff'} /></label><button disabled={busy}>{tag?'태그 변경':'태그 만들기'}</button>{tag&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('이 태그와 노트 연결을 삭제할까요? 노트 내용은 남습니다.'))void remove('tags',tag.id).catch(e=>setError(messageOf(e)));}}>태그 삭제</button>}</div>{error&&<p role="alert">{error}</p>}</form>;
}
function TemplateForm({ template }: { template?: NoteTemplate }) {
 const {save,remove,busy}=useWorkspace();const [error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const v=new FormData(form);setError('');try{await save('note_templates',{title:String(v.get('title')).trim(),content:String(v.get('content'))},template?.id);if(!template)form.reset();}catch(e){setError(messageOf(e));}}
 return <form onSubmit={e=>void submit(e)}><label>템플릿 이름<input name="title" required maxLength={300} defaultValue={template?.title??''}/></label><label>템플릿 내용<textarea name="content" rows={6} maxLength={1000000} defaultValue={template?.content??''}/></label><button disabled={busy}>{template?'템플릿 저장':'템플릿 만들기'}</button>{template&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('템플릿을 삭제할까요? 작성한 노트는 남습니다.'))void remove('note_templates',template.id).catch(e=>setError(messageOf(e)));}}>템플릿 삭제</button>}{error&&<p role="alert">{error}</p>}</form>;
}
export function NoteTools() {
 const {data}=useWorkspace();
 if(!data.tools_available)return <p>태그·내 템플릿을 사용하려면 Cloud 서버 업데이트가 필요합니다.</p>;
 return <details className="card"><summary>태그·템플릿 관리</summary><h3>태그</h3><TagForm/>{data.tags.map(t=><TagForm key={`${t.id}:${t.updated_at}`} tag={t}/>)}<h3>내 템플릿</h3><TemplateForm/>{data.note_templates.map(t=><details key={t.id}><summary>{t.title}</summary><TemplateForm key={t.updated_at} template={t}/></details>)}</details>;
}
