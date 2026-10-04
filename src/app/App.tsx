import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, ChevronDown, ChevronRight, FileText, FolderKanban, Home, Inbox, LayoutGrid, ListTodo, Menu, MoreHorizontal, Search, } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar, Popover } from '../design/components';
import { ProfilePage } from './ProfilePage';
import { SearchPage } from './SearchPage';
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
  const { data, busy } = useWorkspace(); const auth = useAuth(); const { account } = auth;
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
    <div className="sidebar-bottom"><div className="profile"><Avatar name={data.settings.display_name || account?.email || 'Timora'} url={data.settings.avatar_url} /><span><strong>{data.settings.display_name || account?.email || 'Workspace User'}</strong><small>Personal Workspace</small></span><Popover label="프로필 메뉴" trigger={<MoreHorizontal size={18} />}>{dismiss => <><NavLink to="/profile" onClick={() => { dismiss(); close(); }}>Profile</NavLink><NavLink to="/settings" onClick={() => { dismiss(); close(); }}>Settings</NavLink><button type="button" className="danger-button" disabled={busy} onClick={() => { dismiss(); void auth.signOut(); }}>로그아웃</button></>}</Popover></div></div>
  </aside>;
}

function Header({ openSidebar }: { openSidebar: () => void }) {
  const { data } = useWorkspace();
  const location = useLocation();
  const item = [...primary, ...secondary, { label: 'Settings', path: '/settings' }, { label: 'Profile', path: '/profile' }, { label: 'Search', path: '/search' }].find(v => v.path === location.pathname || (v.path === '/projects' && location.pathname.startsWith('/projects/')));
  return <header className="topbar"><div className="breadcrumbs"><button type="button" className="mobile-menu icon-button" onClick={openSidebar} aria-label="메뉴 열기"><Menu size={21} /></button><span>{data.settings.workspace_name}</span><ChevronRight size={15} /><strong>{item?.label ?? 'Home'}</strong></div><div className="header-actions"><span className="sample-pill">v0.2</span><NavLink className="search-trigger" to="/search" aria-label="Workspace 검색"><Search size={18} /><span>검색</span></NavLink></div></header>;
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false); const drawer = useRef<HTMLDivElement>(null); const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    opener.current = document.activeElement as HTMLElement;
    drawer.current?.querySelector<HTMLElement>('a,button')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { setMenuOpen(false); return; }
      if (event.key !== 'Tab') return;
      const items = [...drawer.current!.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')].filter(el => el.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const resize = () => { if (window.innerWidth > 760) setMenuOpen(false); };
    document.addEventListener('keydown', trap); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('keydown', trap); window.removeEventListener('resize', resize); opener.current?.focus(); };
  }, [menuOpen]);
  return <div className="shell"><div ref={drawer} role={menuOpen ? 'dialog' : undefined} aria-modal={menuOpen || undefined} aria-label={menuOpen ? '주 메뉴' : undefined} className={`sidebar-container${menuOpen ? ' open' : ''}`}><Sidebar close={() => setMenuOpen(false)} /></div>{menuOpen && <button type="button" className="scrim" tabIndex={-1} onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기" />}<div className="main-column" inert={menuOpen}><Header openSidebar={() => setMenuOpen(true)} /><main className="content"><WorkspaceContent /></main></div></div>;
}
function WorkspaceContent() {
  const { loading, loaded, error, reload } = useWorkspace(); const auth = useAuth();
  if (loading) return <div className="card" role="status" aria-live="polite">Workspace를 불러오는 중…</div>;
  if (error && !loaded) return <div className="card error" role="alert"><p>{error}</p><button type="button" onClick={() => void reload()}>다시 시도</button><button type="button" onClick={() => void auth.signOut()}>로그아웃</button></div>;
  return <>{error && <div className="error" role="alert"><p>{error}</p><button type="button" onClick={() => void reload()}>다시 시도</button></div>}{auth.error && <p className="error" role="alert">{auth.error}</p>}<Routes><Route path="/" element={<HomePage />} /><Route path="/today" element={<TodayPage />} /><Route path="/inbox" element={<InboxPage />} /><Route path="/tasks" element={<TasksPage />} /><Route path="/notes" element={<NotesPage />} /><Route path="/calendar" element={<CalendarPage />} /><Route path="/projects" element={<ProjectsPage />} /><Route path="/projects/:id" element={<ProjectDetailPage />} /><Route path="/library" element={<LibraryPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/search" element={<SearchPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></>;
}
function AuthGate() {
  const auth = useAuth();
  if (auth.loading) return <main className="auth-screen"><div className="card" role="status">로그인 상태를 확인하는 중…</div></main>;
  if (!auth.account) return <AuthPage />;
  return <WorkspaceProvider key={auth.account.id} account={auth.account}><Shell /></WorkspaceProvider>;
}
export function App() { return <AuthProvider><AuthGate /></AuthProvider>; }

