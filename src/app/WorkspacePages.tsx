import { runtimeLabel } from '../services/runtime';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Inbox, ListTodo, FolderKanban, Sparkles } from 'lucide-react';
import { dateKey, eventOnDay, localDate, monthDays, todayTasks } from '../domain/dates';
import type { EntityTable, Project } from '../domain/models';
import { Empty, PageTitle, SectionTitle } from './components';
import { TaskGroups } from './TaskGroups';
import { inPeriod } from '../domain/task-groups';
import type { PeriodFilter } from '../domain/task-groups';
import { EntityEditor } from './EntityEditor';
import type { EditorTarget } from './EntityEditor';
import { EventList, LibraryList, NoteList, TaskList } from './rows';
import type { OpenEditor } from './rows';
import { messageOf, useAuth, useWorkspace } from './providers';

function useToday(): string {
  const [today, setToday] = useState(() => dateKey());
  useEffect(() => { const interval = window.setInterval(() => setToday(dateKey()), 30000); return () => window.clearInterval(interval); }, []);
  return today;
}
function useEditor() {
  const [target, setTarget] = useState<EditorTarget | null>(null); const { data, loading } = useWorkspace();
  const location = useLocation(); const [params, setParams] = useSearchParams(); const id = params.get('object');
  useEffect(() => {
    if (!id || loading) return;
    const tables: Record<string, EntityTable> = { '/tasks': 'tasks', '/notes': 'notes', '/calendar': 'events', '/library': 'library_items', '/inbox': 'inbox_items' };
    const table = tables[location.pathname]; const item = table && data[table].find(row => row.id === id);
    if (item) setTarget({ table, item });
    const next = new URLSearchParams(params); next.delete('object'); setParams(next, { replace: true });
  }, [id, loading, data, location.pathname, params, setParams]);
  return { open: setTarget as OpenEditor, editor: target && <EntityEditor target={target} onClose={() => setTarget(null)} /> };
}
function ProjectFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useWorkspace();
  return <label>프로젝트<select aria-label="프로젝트" value={value} onChange={event => onChange(event.target.value)}><option value="all">모든 프로젝트</option><option value="none">연결 없음</option>{data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>;
}
function matchesProject(id: string | null, filter: string): boolean { return filter === 'all' || (filter === 'none' ? !id : id === filter); }
function progress(project: Project, tasks: ReturnType<typeof useWorkspace>['data']['tasks']) {
  const related = tasks.filter(task => task.project_id === project.id);
  return related.length ? Math.round(100 * related.filter(task => task.status === 'done').length / related.length) : 0;
}
function Upcoming({ open }: { open: OpenEditor }) {
  const { data } = useWorkspace();
  const events = data.events.filter(event => new Date(event.end_at).getTime() > Date.now()).sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 5);
  return <div className="card upcoming-card"><SectionTitle title="다가오는 일정" to="/calendar" /><EventList events={events} open={open} /></div>;
}
export function HomePage() {
  const { data } = useWorkspace(); const { open, editor } = useEditor(); const today = useToday();
  const tasks = todayTasks(data.tasks, today); const done = tasks.filter(task => task.status === 'done').length;
  const recentProjects = [...data.projects].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 3);
  const unclassified = data.inbox_items.filter(item => item.type === 'unclassified').length;
  const upcoming = data.tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date > today).sort((a, b) => a.due_date!.localeCompare(b.due_date!)).slice(0, 5);
  return <><PageTitle eyebrow={localDate(today).toLocaleDateString('ko-KR', { dateStyle: 'full' })} title="오늘도 나의 흐름으로 👋" description="오늘의 상태를 한눈에 보고, 중요한 일부터 시작해 보세요." /><div className="dashboard-intro"><p>오늘의 작업과 다가오는 일정부터 확인하세요.</p><NavLink className="hero-link" to="/today">오늘의 작업 보기 <ArrowRight size={17} /></NavLink></div><div className="stat-grid"><NavLink to="/today" className="stat-card"><span className="stat-icon purple"><ListTodo size={20} /></span><small>오늘의 작업 진행도</small><strong>{done} / {tasks.length}</strong><span>{tasks.length ? Math.round(done / tasks.length * 100) : 0}% 완료 · 기한 지난 작업 포함</span></NavLink><NavLink to="/projects" className="stat-card"><span className="stat-icon sand"><FolderKanban size={20} /></span><small>진행 중인 프로젝트</small><strong>{data.projects.filter(p => p.status === 'active').length}</strong><span>지금 만들어가는 것들</span></NavLink><NavLink to="/inbox" className="stat-card"><span className="stat-icon mint"><Inbox size={20} /></span><small>미분류 Inbox</small><strong>{unclassified}</strong><span>나중에 정리해도 괜찮아요</span></NavLink></div><div className="two-columns"><div className="card"><SectionTitle title="오늘의 작업" to="/today" count={tasks.length} /><TaskList tasks={tasks.slice(0, 5)} open={open} /></div><Upcoming open={open} /></div><div className="card projects-strip"><SectionTitle title="최근 프로젝트" to="/projects" />{recentProjects.length ? <div className="project-mini-grid">{recentProjects.map(project => <NavLink to={`/projects/${project.id}`} key={project.id} className="project-mini"><span className="project-icon" style={{ background: project.color }}>{project.name[0]}</span><div><strong>{project.name}</strong><small>{project.description || '프로젝트의 흐름을 모아 보세요.'}</small></div><span>{progress(project, data.tasks)}%</span></NavLink>)}</div> : <Empty />}</div><div className="card projects-strip"><SectionTitle title="다가오는 마감" to="/tasks" /><TaskList tasks={upcoming} open={open} /></div><section className="projects-strip"><SectionTitle title="최근 노트" to="/notes" /><NoteList notes={[...data.notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 3)} open={open} /></section>{editor}</>;
}
export function TodayPage() {
  const { data } = useWorkspace(); const { open, editor } = useEditor(); const today = useToday();
  const tasks = todayTasks(data.tasks, today).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));
  const events = data.events.filter(event => eventOnDay(event, today)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  return <><PageTitle eyebrow={today} title="Today" description="오늘 시작하거나 마감하는 작업, 기한이 지난 미완료 작업과 오늘의 일정을 모았습니다." action="새 작업" onAction={() => open({ table: 'tasks', day: today })} /><div className="two-columns"><div className="card"><SectionTitle title="오늘의 작업" count={tasks.length} /><TaskList tasks={tasks} open={open} /></div><div className="card upcoming-card"><SectionTitle title="오늘의 일정" count={events.length} /><EventList events={events} open={open} /><button className="text-link" type="button" onClick={() => open({ table: 'events', day: today })}>일정 추가</button></div></div><div className="card soft-card"><Sparkles size={20} /><div><h2>작업과 일정의 프로젝트 연결을 확인해 보세요</h2><p>프로젝트 이름을 누르면 관련 기록을 한곳에서 볼 수 있습니다.</p></div></div>{editor}</>;
}
export function InboxPage() {
  const { data, busy, save, convert } = useWorkspace(); const { open, editor } = useEditor();
  const [content, setContent] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  async function capture(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError(''); setNotice('');
    try { await save('inbox_items', { content: content.trim(), type: 'unclassified' }); setContent(''); setNotice('Inbox에 기록했습니다.'); } catch (e) { setError(messageOf(e)); }
  }
  async function move(id: string, target: 'task' | 'note') {
    if (busy) return;
    setError(''); setNotice('');
    try { await convert(id, target); setNotice(`${target === 'task' ? 'Task' : 'Note'}로 이동했습니다.`); } catch (e) { setError(messageOf(e)); }
  }
  const items = data.inbox_items.filter(item => filter === 'all' || item.type === filter);
  return <><PageTitle eyebrow="CAPTURE" title="Inbox" description="무엇인지 정하기 전에 먼저 기록하세요. 나중에 분류하고 Task나 Note로 옮길 수 있습니다." /><form className="card capture-form" onSubmit={capture}><label>빠르게 기록<textarea value={content} onChange={event => setContent(event.target.value)} maxLength={20000} rows={3} required placeholder="지금 떠오른 생각을 적어 보세요…" /></label><button type="submit" className="primary-button" disabled={busy || !content.trim()}>{busy ? '처리 중…' : 'Inbox에 저장'}</button></form>{error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}<div className="filters"><label>분류<select aria-label="분류" value={filter} onChange={event => setFilter(event.target.value)}>{Object.entries({ all: '전체', unclassified: '미분류', task: 'Task', note: 'Note', event: 'Event', project: 'Project', resource: 'Library' }).map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select></label></div><div className="card"><SectionTitle title="정리할 기록" count={items.length} />{items.length ? items.map(item => <div className="list-row inbox-row" key={item.id}><div><button type="button" className="row-title" onClick={() => open({ table: 'inbox_items', item })}>{item.content}</button><small>{new Date(item.created_at).toLocaleString('ko-KR')} · {item.type === 'unclassified' ? '미분류' : item.type}</small></div><div className="row-actions"><button type="button" disabled={busy} onClick={() => void move(item.id, 'task')}>Task로</button><button type="button" disabled={busy} onClick={() => void move(item.id, 'note')}>Note로</button></div></div>) : <Empty>기록이 없습니다. 생각이 떠오르면 위에서 빠르게 저장해 보세요.</Empty>}</div>{editor}</>;
}
export function TasksPage() {
  const { data } = useWorkspace(); const today = useToday(); const [period, setPeriod] = useState<PeriodFilter>('all'); const { open, editor } = useEditor();
  const [status, setStatus] = useState('all'); const [priority, setPriority] = useState('all'); const [project, setProject] = useState('all'); const [query, setQuery] = useState('');
  const tasks = data.tasks.filter(task => inPeriod(task, today, period) && (status === 'all' || task.status === status) && (priority === 'all' || task.priority === priority) && matchesProject(task.project_id, project) && task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <><PageTitle eyebrow="PLAN" title="Tasks" description="작업의 상태, 우선순위, 날짜와 프로젝트를 관리하세요." action="새 작업" onAction={() => open({ table: 'tasks' })} /><div className="filters"><label>제목 검색<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><label>상태<select aria-label="상태" value={status} onChange={event => setStatus(event.target.value)}><option value="all">전체</option><option value="todo">미완료</option><option value="in_progress">진행 중</option><option value="done">완료</option></select></label><label>우선순위<select aria-label="우선순위" value={priority} onChange={event => setPriority(event.target.value)}><option value="all">전체</option><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></label><ProjectFilter value={project} onChange={setProject} /></div><div className="period-filters" aria-label="기간 필터">{Object.entries({ all: '전체', today: '오늘', week: '이번 주', month: '이번 달' }).map(([key, label]) => <button type="button" aria-pressed={period === key} className={period === key ? 'selected' : ''} key={key} onClick={() => setPeriod(key as PeriodFilter)}>{label}</button>)}</div><TaskGroups tasks={tasks} today={today} owner={data.settings.user_id} open={open} />{editor}</>;
}
export function NotesPage() {
  const { data } = useWorkspace(); const { open, editor } = useEditor(); const [project, setProject] = useState('all'); const [query, setQuery] = useState('');
  const notes = data.notes.filter(note => matchesProject(note.project_id, project) && note.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <><PageTitle eyebrow="THINK" title="Notes" description="Markdown으로 생각을 기록하고 프로젝트와 연결하세요." action="새 노트" onAction={() => open({ table: 'notes' })} /><div className="filters"><label>제목 검색<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><ProjectFilter value={project} onChange={setProject} /></div><NoteList notes={notes} open={open} />{editor}</>;
}
export function CalendarPage() {
  const { data } = useWorkspace(); const { open, editor } = useEditor(); const today = useToday();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [day, setDay] = useState(today);
  const days = monthDays(month);
  function shift(amount: number) { const next = new Date(month.getFullYear(), month.getMonth() + amount, 1); setMonth(next); setDay(dateKey(next)); }
  const events = data.events.filter(event => eventOnDay(event, day)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const tasks = data.tasks.filter(task => task.due_date === day);
  return <><PageTitle eyebrow="TIME" title="Calendar" description="일정과 Task 마감일을 함께 확인하세요. 날짜를 선택하면 상세 내용을 볼 수 있습니다." action="새 일정" onAction={() => open({ table: 'events', day })} /><div className="card calendar-card"><div className="calendar-head"><div><h2>{month.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}</h2><span>기기 시간대: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div><div className="calendar-controls"><button type="button" aria-label="이전 달" onClick={() => shift(-1)}><ChevronLeft size={18} /></button><button type="button" onClick={() => { setMonth(new Date(localDate(today).getFullYear(), localDate(today).getMonth(), 1)); setDay(today); }}>오늘</button><button type="button" aria-label="다음 달" onClick={() => shift(1)}><ChevronRight size={18} /></button></div></div><div className="calendar-scroll"><div className="calendar-grid">{['일', '월', '화', '수', '목', '금', '토'].map(d => <div className="calendar-weekday" key={d}>{d}</div>)}{days.map(date => {
    const key = dateKey(date); const dayEvents = data.events.filter(event => eventOnDay(event, key)); const dueTasks = data.tasks.filter(task => task.due_date === key);
    return <button type="button" aria-label={`${key}, 일정 ${dayEvents.length}개, 마감 작업 ${dueTasks.length}개`} aria-pressed={day === key} className={`calendar-day${date.getMonth() !== month.getMonth() ? ' dimmed' : ''}${key === today ? ' marked' : ''}${key === day ? ' selected-day' : ''}`} key={key} onClick={() => setDay(key)}><span>{date.getDate()}</span>{dayEvents.slice(0, 2).map(event => <small key={event.id}>{event.title}</small>)}{dueTasks.slice(0, 1).map(task => <small className="calendar-task" key={task.id}>✓ {task.title}</small>)}{dayEvents.length + dueTasks.length > Math.min(dayEvents.length, 2) + Math.min(dueTasks.length, 1) && <small>+{dayEvents.length + dueTasks.length - Math.min(dayEvents.length, 2) - Math.min(dueTasks.length, 1)}</small>}</button>;
  })}</div></div></div><div className="two-columns calendar-detail"><div className="card upcoming-card"><SectionTitle title={`${day} 일정`} count={events.length} /><EventList events={events} open={open} /><button className="text-link" type="button" onClick={() => open({ table: 'events', day })}>이 날짜에 일정 추가</button></div><div className="card"><SectionTitle title="마감 작업" count={tasks.length} /><TaskList tasks={tasks} open={open} /><button className="text-link" type="button" onClick={() => open({ table: 'tasks', day })}>마감 작업 추가</button></div></div>{editor}</>;
}
export function ProjectsPage() {
  const { data } = useWorkspace(); const { open, editor } = useEditor(); const [status, setStatus] = useState('all');
  const projects = data.projects.filter(p => status === 'all' || status === p.status);
  return <><PageTitle eyebrow="BUILD" title="Projects" description="진행 중인 일의 맥락을 한곳에서 관리합니다." action="새 프로젝트" onAction={() => open({ table: 'projects' })} /><div className="filters"><label>상태<select aria-label="상태" value={status} onChange={event => setStatus(event.target.value)}><option value="all">전체</option><option value="active">진행 중</option><option value="paused">보류</option><option value="completed">완료</option></select></label></div>{projects.length ? <div className="project-grid">{projects.map(project => <article className="card project-card" key={project.id}><span className="project-icon large" style={{ background: project.color }}>{project.name[0]}</span><h2><NavLink to={`/projects/${project.id}`}>{project.name}</NavLink></h2><p>{project.description}</p><div className="progress-label"><span>Task 완료율</span><strong>{progress(project, data.tasks)}%</strong></div><div className="progress-track"><span style={{ width: `${progress(project, data.tasks)}%`, background: project.color }} /></div><div className="project-foot"><span>{data.tasks.filter(t => t.project_id === project.id).length}개 작업 · {project.status}</span><button className="text-link" type="button" onClick={() => open({ table: 'projects', item: project })}>수정</button></div></article>)}</div> : <Empty />}{editor}</>;
}
export function ProjectDetailPage() {
  const { id } = useParams(); const { data } = useWorkspace(); const { open, editor } = useEditor(); const [tab, setTab] = useState('overview');
  const project = data.projects.find(p => p.id === id);
  if (!project) return <div className="card"><Empty>프로젝트가 없거나 접근할 수 없습니다.</Empty><NavLink to="/projects">프로젝트 목록으로</NavLink></div>;
  const tasks = data.tasks.filter(t => t.project_id === id); const notes = data.notes.filter(t => t.project_id === id); const events = data.events.filter(t => t.project_id === id).sort((a, b) => a.start_at.localeCompare(b.start_at)); const library = data.library_items.filter(t => t.project_id === id);
  const tables: Record<string, EntityTable> = { tasks: 'tasks', notes: 'notes', events: 'events', library: 'library_items' };
  return <><NavLink className="text-link" to="/projects">← 프로젝트 목록</NavLink><PageTitle eyebrow="PROJECT WORKSPACE" title={project.name} description={project.description || '프로젝트의 작업과 기록을 한곳에 모아 보세요.'} /><button type="button" onClick={() => open({ table: 'projects', item: project })}>프로젝트 수정 / 삭제</button><div className="tab-display project-tabs">{Object.entries({ overview: 'Overview', tasks: `Tasks (${tasks.length})`, notes: `Notes (${notes.length})`, events: `Events (${events.length})`, library: `Library (${library.length})` }).map(([key, label]) => <button type="button" key={key} className={tab === key ? 'selected' : ''} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>{tab === 'overview' ? <div className="card"><SectionTitle title="Overview" /><p>상태: {project.status} · Task 완료율: {progress(project, data.tasks)}%</p><p>{tasks.length}개 작업 · {notes.length}개 노트 · {events.length}개 일정 · {library.length}개 자료</p><p>GitHub Integration은 후속 버전에서 추가됩니다.</p></div> : <><button className="primary-button" type="button" onClick={() => open({ table: tables[tab], projectId: project.id })}>연결된 항목 추가</button><div className="card project-content">{tab === 'tasks' && <TaskList tasks={tasks} open={open} />}{tab === 'notes' && <NoteList notes={notes} open={open} />}{tab === 'events' && <EventList events={events} open={open} />}{tab === 'library' && <LibraryList items={library} open={open} />}</div></>}{editor}</>;
}
export function LibraryPage() {
  const { data } = useWorkspace(); const { open, editor } = useEditor(); const [project, setProject] = useState('all'); const [type, setType] = useState('all');
  const items = data.library_items.filter(item => matchesProject(item.project_id, project) && (type === 'all' || item.type === type));
  return <><PageTitle eyebrow="KEEP" title="Library" description="웹사이트, 자료, 영상과 파일의 URL을 저장하고 프로젝트와 연결하세요." action="자료 추가" onAction={() => open({ table: 'library_items' })} /><div className="filters"><ProjectFilter value={project} onChange={setProject} /><label>자료 종류<select aria-label="자료 종류" value={type} onChange={event => setType(event.target.value)}>{['all', 'website', 'article', 'github', 'video', 'pdf', 'file', 'other'].map(value => <option key={value} value={value}>{value === 'all' ? '전체' : value}</option>)}</select></label></div><div className="card"><SectionTitle title="보관한 자료" count={items.length} /><LibraryList items={items} open={open} /></div>{editor}</>;
}
export function SettingsPage() {
  const auth = useAuth(); const { data, saveSettings, busy } = useWorkspace(); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget); setError(''); setNotice('');
    try { await saveSettings({ ...data.settings, workspace_name: String(form.get('workspace_name')).trim(), appearance: String(form.get('appearance')) as 'light' | 'dark' | 'system' }); setNotice('설정을 저장했습니다.'); } catch (e) { setError(messageOf(e)); }
  }
  return <><PageTitle eyebrow="PREFERENCES" title="Settings" description="계정과 Workspace의 기본 설정을 관리하세요." /><div className="settings-grid"><section className="card settings-card"><SectionTitle title="Account" /><p>{auth.account?.local ? auth.account.email || '기존 로컬 Workspace' : auth.account?.email}</p>{auth.account?.local ? <><NavLink to="/account">계정 연결 / 다시 인증</NavLink><br /><NavLink to="/cloud-import">Cloud 가져오기 / DB 위치</NavLink><p>자동 동기화·백업은 아직 지원하지 않습니다.</p></> : null}{(!auth.account?.local || !auth.account.local_only) && <button className="danger-button" type="button" disabled={busy} onClick={() => void auth.signOut()}>로그아웃</button>}</section><section className="card settings-card"><SectionTitle title="Workspace / Appearance" /><form key={data.settings.updated_at} onSubmit={submit}><fieldset disabled={busy}><label>Workspace 이름<input name="workspace_name" defaultValue={data.settings.workspace_name} maxLength={80} required /></label><label>Appearance<select aria-label="Appearance" name="appearance" defaultValue={data.settings.appearance}><option value="system">기기 설정 따르기</option><option value="light">Light</option><option value="dark">Dark</option></select></label><button className="primary-button" type="submit">{busy ? '저장 중…' : '설정 저장'}</button></fieldset></form>{error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}</section><section className="card settings-card"><SectionTitle title="Coming later" />{['GitHub Integration · v0.5', 'Cloud Sync / Conflict · v0.4', 'Backup / Security · v0.7', 'Notifications / Widgets · v1.1+', 'Shortcuts / Storage · 후속 버전'].map(label => <div key={label} className="setting-line"><strong>{label}</strong><span className="row-tag">Coming later</span></div>)}</section><section className="card settings-card"><SectionTitle title="Timora v0.3" /><p>{auth.account?.local ? `${runtimeLabel} · SQLite 로컬 저장` : 'Web · Supabase 저장'}</p><p>파일 업로드, 다중 Workspace, GitHub 연결과 Cloud 자동 동기화는 후속 버전입니다.</p></section></div></>;
}
