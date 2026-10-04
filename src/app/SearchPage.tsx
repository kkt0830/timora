import { useEffect, useRef, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { searchWorkspace } from '../domain/search';
import { Empty, PageTitle } from './components';
import { useWorkspace } from './providers';
const paths = { tasks: '/tasks', notes: '/notes', projects: '/projects', library_items: '/library', inbox_items: '/inbox', events: '/calendar' };
const labels = { tasks: 'Task', notes: 'Note', projects: 'Project', library_items: 'Library', inbox_items: 'Inbox', events: 'Event' };
export function SearchPage() {
  const { data } = useWorkspace(); const [params, setParams] = useSearchParams(); const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const composing = useRef(false);
  useEffect(() => { if (!composing.current) setDraft(query); }, [query]);
  function commit(value: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set('q', value); else next.delete('q');
      return next;
    }, { replace: true });
  }
  const results = searchWorkspace(data, query);
  return <><PageTitle eyebrow="FIND" title="Search" description="제목, 내용, 프로젝트와 자료 URL에서 필요한 기록을 찾으세요." /><label>Workspace 검색<input autoFocus className="search-input" type="search" value={draft} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={event => { composing.current = false; setDraft(event.currentTarget.value); commit(event.currentTarget.value); }} onChange={event => { const value = event.target.value; setDraft(value); if (!composing.current) commit(value); }} placeholder="검색어 입력" /></label><div role="status" className="muted">{query.trim() ? `${results.length}개 결과` : '검색어를 입력해 주세요.'}</div><section className="card search-results">{results.length ? results.map(result => <NavLink key={`${result.table}:${result.id}`} className="search-result" to={result.table === 'projects' ? `/projects/${result.id}` : `${paths[result.table]}?object=${encodeURIComponent(result.id)}`}><span className="row-tag">{labels[result.table]}</span><strong>{result.title}</strong><p>{result.context}</p><small>{result.project} · {result.metadata}</small></NavLink>) : <Empty>{query.trim() ? '일치하는 기록이 없습니다.' : 'Task, Note, Project, Library, Inbox, Event를 검색할 수 있습니다.'}</Empty>}</section></>;
}
