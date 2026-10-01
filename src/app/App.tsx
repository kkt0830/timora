import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Bell, BookOpen, CalendarDays, ChevronDown, ChevronRight, FileText, FolderKanban, Home, Inbox, LayoutGrid, ListTodo, Menu, MoreHorizontal, Search, Settings2, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AuthPage } from './AuthPage';
import { AuthProvider, WorkspaceProvider, useAuth, useWorkspace } from './providers';
import { HomePage, TodayPage, InboxPage, TasksPage, NotesPage, CalendarPage, ProjectsPage, ProjectDetailPage, LibraryPage, SettingsPage } from './WorkspacePages';

type NavItem = { label: string; path: string; icon: LucideIcon; count?: number };
const primary: NavItem[] = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Today', path: '/today', icon: LayoutGrid },
  { label: 'Inbox', path: '/inbox', icon: Inbox },
  { label: 'Tasks', path: '/tasks', icon: ListTodo },
  { label: 'Notes', path: '/notes', icon: FileText },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
];
const secondary: NavItem[] = [
  { label: 'Projects', path: '/projects', icon: FolderKanban },
  { label: 'Library', path: '/library', icon: BookOpen },
];

function Sidebar({ close }: { close: () => void }) {
  const { data } = useWorkspace(); const { account } = useAuth();
  const workspaceName = data.settings.workspace_name;
  const list = (items: NavItem[]) => items.map(({ label, path, icon: Icon, count }) => (
    <NavLink end={path === '/'} key={path} to={path} onClick={close}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </NavLink>
  ));

  return <aside className="sidebar">
    <div className="brand"><div className="brand-symbol"><span /></div><div><strong>timora</strong><small>your personal space</small></div></div>
    <div className="space-switch"><span className="space-avatar">W</span><span><strong>{workspaceName}</strong><small>Personal space</small></span><ChevronDown size={15} className="muted" /></div>
    <nav aria-label="주 메뉴"><div className="nav-label">WORKSPACE</div>{list(primary.map(item => item.path === '/inbox' ? { ...item, count: data.inbox_items.length } : item))}<div className="nav-label nav-section">ORGANIZE</div>{list(secondary)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-hint"><Sparkles size={16} /><span>오늘의 작은 기록이<br />내일의 흐름을 만들어요.</span></div>{list([{ label: 'Settings', path: '/settings', icon: Settings2 }])}<div className="profile"><span className="profile-avatar">W</span><span><strong>{account?.email ?? 'Workspace User'}</strong><small>Timora v0.1</small></span><MoreHorizontal size={18} /></div></div>
  </aside>;
}

function Header({ openSidebar }: { openSidebar: () => void }) {
  const { data, reload, busy, loading } = useWorkspace();
  const location = useLocation();
  const item = [...primary, ...secondary, { label: 'Settings', path: '/settings' }].find(v => v.path === location.pathname || (v.path === '/projects' && location.pathname.startsWith('/projects/')));
  return <header className="topbar"><div className="breadcrumbs"><button type="button" className="mobile-menu icon-button" onClick={openSidebar} aria-label="메뉴 열기"><Menu size={21} /></button><span>{data.settings.workspace_name}</span><ChevronRight size={15} /><strong>{item?.label ?? 'Home'}</strong></div><div className="header-actions"><span className="sample-pill">v0.1</span><button className="search-trigger" type="button" disabled title="전역 검색은 v0.4에서 구현 예정"><Search size={16} /><span>Search anything...</span><kbd>⌘ K</kbd></button><button className="icon-button" type="button" disabled title="알림은 v1.1에서 구현 예정"><Bell size={19} /></button><button type="button" disabled={busy || loading} onClick={() => void reload()}>새로고침</button></div></header>;
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="shell"><div className={`sidebar-container${menuOpen ? ' open' : ''}`}><Sidebar close={() => setMenuOpen(false)} /></div>{menuOpen && <button type="button" className="scrim" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기" />}<div className="main-column"><Header openSidebar={() => setMenuOpen(true)} /><main className="content"><WorkspaceContent /></main></div></div>;
}
function WorkspaceContent() {
  const { loading, error, reload } = useWorkspace(); const auth = useAuth();
  if (loading) return <div className="card" role="status" aria-live="polite">Workspace를 불러오는 중…</div>;
  if (error) return <div className="card error" role="alert"><p>{error}</p><button type="button" onClick={() => void reload()}>다시 시도</button><button type="button" onClick={() => void auth.signOut()}>로그아웃</button></div>;
  return <>{auth.error && <p className="error" role="alert">{auth.error}</p>}<Routes><Route path="/" element={<HomePage />} /><Route path="/today" element={<TodayPage />} /><Route path="/inbox" element={<InboxPage />} /><Route path="/tasks" element={<TasksPage />} /><Route path="/notes" element={<NotesPage />} /><Route path="/calendar" element={<CalendarPage />} /><Route path="/projects" element={<ProjectsPage />} /><Route path="/projects/:id" element={<ProjectDetailPage />} /><Route path="/library" element={<LibraryPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></>;
}
function AuthGate() {
  const auth = useAuth();
  if (auth.loading) return <main className="auth-screen"><div className="card" role="status">로그인 상태를 확인하는 중…</div></main>;
  if (!auth.account) return <AuthPage />;
  return <WorkspaceProvider key={auth.account.id} account={auth.account}><Shell /></WorkspaceProvider>;
}
export function App() { return <AuthProvider><AuthGate /></AuthProvider>; }

