import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Archive, ArrowRight, Bell, BookOpen, CalendarDays, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, FileText, FolderKanban,
  Github, Home, Inbox, LayoutGrid, Link2, ListTodo, Menu, MoreHorizontal,
  Plus, Search, Settings2, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { events, inbox, notes, projects, resources, tasks } from '../data/sample';
import type { Task } from '../domain/models';

type NavItem = { label: string; path: string; icon: LucideIcon; count?: number };
const primary: NavItem[] = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Today', path: '/today', icon: LayoutGrid },
  { label: 'Inbox', path: '/inbox', icon: Inbox, count: inbox.length },
  { label: 'Tasks', path: '/tasks', icon: ListTodo },
  { label: 'Notes', path: '/notes', icon: FileText },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
];
const secondary: NavItem[] = [
  { label: 'Projects', path: '/projects', icon: FolderKanban },
  { label: 'Library', path: '/library', icon: BookOpen },
];

function Sidebar({ close }: { close: () => void }) {
  const list = (items: NavItem[]) => items.map(({ label, path, icon: Icon, count }) => (
    <NavLink end={path === '/'} key={path} to={path} onClick={close}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </NavLink>
  ));

  return <aside className="sidebar">
    <div className="brand"><div className="brand-symbol"><span /></div><div><strong>timora</strong><small>your personal space</small></div></div>
    <div className="space-switch"><span className="space-avatar">W</span><span><strong>My Workspace</strong><small>Personal space</small></span><ChevronDown size={15} className="muted" /></div>
    <nav aria-label="주 메뉴"><div className="nav-label">WORKSPACE</div>{list(primary)}<div className="nav-label nav-section">ORGANIZE</div>{list(secondary)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-hint"><Sparkles size={16} /><span>오늘의 작은 기록이<br />내일의 흐름을 만들어요.</span></div>{list([{ label: 'Settings', path: '/settings', icon: Settings2 }])}<div className="profile"><span className="profile-avatar">W</span><span><strong>Workspace User</strong><small>Skeleton preview</small></span><MoreHorizontal size={18} /></div></div>
  </aside>;
}

function Header({ openSidebar }: { openSidebar: () => void }) {
  const location = useLocation();
  const item = [...primary, ...secondary, { label: 'Settings', path: '/settings' }].find(v => v.path === location.pathname);
  return <header className="topbar"><div className="breadcrumbs"><button type="button" className="mobile-menu icon-button" onClick={openSidebar} aria-label="메뉴 열기"><Menu size={21} /></button><span>My Workspace</span><ChevronRight size={15} /><strong>{item?.label ?? 'Home'}</strong></div><div className="header-actions"><span className="sample-pill">SAMPLE PREVIEW</span><button className="search-trigger" type="button" disabled title="전역 검색은 v0.4에서 구현 예정"><Search size={16} /><span>Search anything...</span><kbd>⌘ K</kbd></button><button className="icon-button" type="button" disabled title="알림은 v1.1에서 구현 예정"><Bell size={19} /></button><span className="header-avatar">W</span></div></header>;
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="shell"><div className={`sidebar-container${menuOpen ? ' open' : ''}`}><Sidebar close={() => setMenuOpen(false)} /></div>{menuOpen && <button type="button" className="scrim" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기" />}<div className="main-column"><Header openSidebar={() => setMenuOpen(true)} /><main className="content"><Routes><Route path="/" element={<HomePage />} /><Route path="/today" element={<TodayPage />} /><Route path="/inbox" element={<InboxPage />} /><Route path="/tasks" element={<TasksPage />} /><Route path="/notes" element={<NotesPage />} /><Route path="/calendar" element={<CalendarPage />} /><Route path="/projects" element={<ProjectsPage />} /><Route path="/library" element={<LibraryPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></main></div></div>;
}
export function App() { return <Shell />; }

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: string }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <button className="primary-button" type="button" disabled title="생성 기능은 v0.1에서 구현 예정"><Plus size={17} />{action}</button>}</div>;
}
function SectionTitle({ title, to, count }: { title: string; to?: string; count?: number }) {
  return <div className="section-title"><div><h2>{title}</h2>{count !== undefined && <span className="count-badge">{count}</span>}</div>{to && <NavLink to={to} className="text-link">전체 보기 <ArrowRight size={15} /></NavLink>}</div>;
}
function TaskRow({ task }: { task: Task }) {
  const project = projects.find(p => p.id === task.projectId);
  return <div className="task-row"><span className={`checkbox-mock${task.status === 'done' ? ' checked' : ''}`} aria-label={task.status === 'done' ? '완료' : '미완료'}>{task.status === 'done' && <Check size={13} />}</span><div className="task-main"><span className={task.status === 'done' ? 'done-text' : ''}>{task.title}</span><small>{project?.title ?? '개인 작업'}</small></div><span className={`priority ${task.priority}`}>{task.priority === 'high' ? '중요' : task.priority === 'medium' ? '보통' : '낮음'}</span><span className="task-due">{task.dueAt?.slice(5).replace('-', '.')}</span></div>;
}
function UpcomingCard() {
  return <div className="card upcoming-card"><SectionTitle title="다가오는 일정" to="/calendar" /><div className="event-list">{events.map(event => <div className="event-row" key={event.id}><div className="event-date"><strong>{event.startsAt.slice(8, 10)}</strong><span>SEP</span></div><div><strong>{event.title}</strong><small>{event.startsAt.slice(11, 16)} – {event.endsAt.slice(11, 16)}</small></div><span className="event-dot" /></div>)}</div></div>;
}

function HomePage() {
  return <><PageTitle eyebrow="MONDAY, SEPTEMBER 28 · SAMPLE" title="좋은 저녁이에요 👋" description="오늘의 흐름을 한눈에 보고, 중요한 일부터 시작해 보세요." /><div className="hero"><div><span className="hero-eyebrow"><Sparkles size={14} /> YOUR SPACE, YOUR PACE</span><h2>생각을 정리하고,<br />작은 진전을 쌓아가세요.</h2><p>오늘 할 일과 프로젝트를 한 공간에서 살펴보세요.</p><NavLink className="hero-link" to="/today">오늘의 작업 보기 <ArrowRight size={17} /></NavLink></div><div className="hero-art" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="hero-core">✦</span><span className="art-dot one" /><span className="art-dot two" /></div></div><div className="stat-grid"><NavLink to="/tasks" className="stat-card"><span className="stat-icon purple"><ListTodo size={20} /></span><small>진행 중인 작업</small><strong>{tasks.filter(t => t.status !== 'done').length}<em> tasks</em></strong><span>하나씩 차근차근</span></NavLink><NavLink to="/projects" className="stat-card"><span className="stat-icon sand"><FolderKanban size={20} /></span><small>진행 중인 프로젝트</small><strong>{projects.length}<em> projects</em></strong><span>지금 만들어가는 것들</span></NavLink><NavLink to="/inbox" className="stat-card"><span className="stat-icon mint"><Inbox size={20} /></span><small>정리할 생각</small><strong>{inbox.length}<em> items</em></strong><span>나중에 정리해도 괜찮아요</span></NavLink></div><div className="two-columns"><div className="card"><SectionTitle title="오늘의 작업" to="/tasks" count={tasks.length} /><div>{tasks.slice(0, 3).map(t => <TaskRow task={t} key={t.id} />)}</div></div><UpcomingCard /></div><div className="card projects-strip"><SectionTitle title="진행 중인 프로젝트" to="/projects" /><div className="project-mini-grid">{projects.map(project => <div key={project.id} className="project-mini"><span className="project-icon" style={{ background: project.color }}>{project.title[0]}</span><div><strong>{project.title}</strong><small>{project.description}</small></div><span>{project.progress}%</span></div>)}</div></div></>;
}
function TodayPage() {
  return <><PageTitle eyebrow="FOCUS / SAMPLE DAY" title="Today" description="오늘 살펴볼 작업과 일정을 모았습니다. 날짜와 내용은 샘플입니다." /><div className="two-columns"><div className="card"><SectionTitle title="오늘의 우선순위" count={tasks.filter(t => t.status !== 'done').length} /><div>{tasks.filter(t => t.status !== 'done').map(t => <TaskRow task={t} key={t.id} />)}</div></div><UpcomingCard /></div><div className="card soft-card"><div className="soft-icon"><Sparkles size={20} /></div><div><h2>집중할 일을 골라 보세요</h2><p>이 영역에는 향후 오늘의 목표와 회고가 연결됩니다.</p></div></div></>;
}
function InboxPage() {
  return <><PageTitle eyebrow="CAPTURE / SAMPLE DATA" title="Inbox" description="떠오른 생각을 잠시 놓아두고, 나중에 작업이나 노트로 정리할 공간입니다." action="빠르게 기록" /><div className="card"><SectionTitle title="아직 정리하지 않은 항목" count={inbox.length} />{inbox.map(item => <div className="list-row" key={item.id}><span className="list-icon lavender"><Inbox size={18} /></span><div><strong>{item.content}</strong><small>{item.capturedAt.slice(0, 10)} 기록</small></div><span className="row-tag">미분류</span></div>)}</div></>;
}
function TasksPage() {
  return <><PageTitle eyebrow="PLAN / SAMPLE DATA" title="Tasks" description="해야 할 일의 상태와 우선순위를 살펴보세요." action="새 작업" /><div className="tab-display"><span className="selected">전체 <b>{tasks.length}</b></span><span>진행 중</span><span>완료</span></div><div className="card"><SectionTitle title="모든 작업" count={tasks.length} />{tasks.map(task => <TaskRow task={task} key={task.id} />)}</div></>;
}
function NotesPage() {
  return <><PageTitle eyebrow="THINK / SAMPLE DATA" title="Notes" description="떠오른 생각과 배운 것을 기록하는 공간입니다." action="새 노트" /><div className="notes-grid">{notes.map(note => <article className="card note-card" key={note.id}><span className="note-symbol"><FileText size={19} /></span><h2>{note.title}</h2><p>{note.excerpt}</p><div className="note-footer"><span>{note.category}</span><span>{note.updatedAt}</span></div></article>)}</div></>;
}
function CalendarPage() {
  const days = Array.from({ length: 35 }, (_, i) => i - 1); // September 2026 starts Tuesday.
  return <><PageTitle eyebrow="TIME / SAMPLE MONTH" title="Calendar" description="일정과 작업의 시간을 함께 살펴볼 공간입니다." action="새 일정" /><div className="card calendar-card"><div className="calendar-head"><div><h2>September 2026</h2><span>샘플 달력</span></div><div className="calendar-controls"><button type="button" disabled title="월 이동은 v0.1에서 구현 예정" aria-label="이전 달"><ChevronLeft size={18} /></button><button type="button" disabled title="월 이동은 v0.1에서 구현 예정" aria-label="다음 달"><ChevronRight size={18} /></button></div></div><div className="calendar-grid">{['일', '월', '화', '수', '목', '금', '토'].map(d => <div className="calendar-weekday" key={d}>{d}</div>)}{days.map((offset, i) => { const day = offset < 1 ? 31 + offset : offset > 30 ? offset - 30 : offset; const muted = offset < 1 || offset > 30; const dayEvents = muted ? [] : events.filter(e => Number(e.startsAt.slice(8, 10)) === day); return <div className={`calendar-day${muted ? ' dimmed' : ''}${day === 28 && !muted ? ' marked' : ''}`} key={i}><span>{day}</span>{dayEvents.map(e => <small key={e.id}>{e.title}</small>)}</div>; })}</div></div></>;
}
function ProjectsPage() {
  return <><PageTitle eyebrow="BUILD / SAMPLE DATA" title="Projects" description="진행 중인 일의 맥락을 한곳에서 관리합니다." action="새 프로젝트" /><div className="project-grid">{projects.map(project => <article className="card project-card" key={project.id}><span className="project-icon large" style={{ background: project.color }}>{project.title[0]}</span><h2>{project.title}</h2><p>{project.description}</p><div className="progress-label"><span>진행 상태</span><strong>{project.progress}%</strong></div><div className="progress-track"><span style={{ width: `${project.progress}%`, background: project.color }} /></div><div className="project-foot"><span>{tasks.filter(t => t.projectId === project.id).length}개의 작업</span><span>샘플 프로젝트</span></div></article>)}</div></>;
}
function LibraryPage() {
  const icons = { document: FileText, link: Link2, file: Archive };
  return <><PageTitle eyebrow="KEEP / SAMPLE DATA" title="Library" description="문서, 링크, 파일을 다시 찾기 쉽게 모아둘 공간입니다." action="자료 추가" /><div className="card"><SectionTitle title="보관한 자료" count={resources.length} />{resources.map(resource => { const Icon = icons[resource.resourceType]; return <div className="list-row" key={resource.id}><span className="list-icon pale"><Icon size={19} /></span><div><strong>{resource.title}</strong><small>{resource.description}</small></div><span className="row-tag">{resource.resourceType}</span></div>; })}</div></>;
}
function SettingsPage() {
  return <><PageTitle eyebrow="PREFERENCES / PLACEHOLDERS" title="Settings" description="계정과 연결 기능이 추가될 위치를 미리 볼 수 있습니다." /><div className="settings-grid"><div className="card settings-card"><SectionTitle title="내 작업 공간" /><div className="setting-line"><span className="list-icon lavender"><Home size={19} /></span><div><strong>My Workspace</strong><small>개인 작업 공간 · 샘플 환경</small></div><span className="row-tag">Preview</span></div></div><div className="card settings-card"><SectionTitle title="향후 연결" /><div className="setting-line"><span className="list-icon pale"><Github size={19} /></span><div><strong>GitHub</strong><small>v0.2에서 연동 예정</small></div><span className="row-tag">예정</span></div><div className="setting-line"><span className="list-icon mint"><Link2 size={19} /></span><div><strong>Cloud Sync</strong><small>v0.6에서 동기화 기반 준비 예정</small></div><span className="row-tag">예정</span></div></div><div className="card settings-card"><SectionTitle title="정보" /><div className="setting-line"><span className="list-icon pale"><CircleHelp size={19} /></span><div><strong>Skeleton Preview</strong><small>실제 계정과 데이터는 연결되어 있지 않습니다.</small></div><span className="row-tag">0.0.1</span></div></div></div></>;
}
