import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarDays, FileText, FolderKanban, Home, Inbox, LayoutGrid, ListTodo, Menu, MoreHorizontal, Search, RefreshCw, } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar, Popover } from '../design/components';
import { SyncPage, syncLabel } from './SyncPage';
import { ProfilePage } from './ProfilePage';
import { isAndroid, isNative } from '../services/runtime';
import { registerBackHandler } from '../services/native-back';
import { CloudImportPage } from './CloudImportPage';
import { SearchPage } from './SearchPage';
import { AuthPage } from './AuthPage';
import { AuthProvider, WorkspaceProvider, useAuth, useWorkspace, useSync } from './providers';
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
    <div className="brand"><div className="brand-symbol" aria-hidden="true">t</div><div><strong>timora</strong><small>your personal space</small></div></div>
    <nav aria-label="주 메뉴"><div className="nav-label">WORKSPACE</div>{list(primary.map(item => item.path === '/inbox' ? { ...item, count: data.inbox_items.length } : item))}<div className="nav-label nav-section">ORGANIZE</div>{list(secondary)}</nav>
    <div className="sidebar-bottom"><div className="profile"><Avatar name={data.settings.display_name || account?.email || 'Timora'} url={data.settings.avatar_url} /><span><strong>{data.settings.display_name || account?.email || 'Workspace User'}</strong><small>Personal Workspace</small></span><Popover label="프로필 메뉴" trigger={<MoreHorizontal size={18} />}>{dismiss => <><div className="popover-workspace"><small>Workspace</small><strong>{workspaceName}</strong></div><NavLink to="/profile" onClick={() => { dismiss(); close(); }}>Profile</NavLink><NavLink to="/settings" onClick={() => { dismiss(); close(); }}>Settings</NavLink><>{account?.local && <NavLink to="/account" onClick={() => { dismiss(); close(); }}>계정 연결</NavLink>}{account?.local && <NavLink to="/sync" onClick={() => { dismiss(); close(); }}>Cloud 동기화</NavLink>}{account?.local ? <NavLink to="/cloud-import" onClick={() => { dismiss(); close(); }}>Cloud 가져오기</NavLink> : null}{(!account?.local || !account.local_only) && <button type="button" className="danger-button" disabled={busy} onClick={() => { dismiss(); void auth.signOut(); }}>로그아웃</button>}</></>}</Popover></div></div>
  </aside>;
}

function Header({ openSidebar }: { openSidebar: () => void }) {
  const location = useLocation(); const { account } = useAuth(); const { state } = useSync();
  const item = [...primary, ...secondary, { label: 'Settings', path: '/settings' }, { label: 'Profile', path: '/profile' }, { label: 'Search', path: '/search' }, { label: 'Cloud 가져오기', path: '/cloud-import' }, { label: '계정 연결', path: '/account' }, { label: 'Cloud 동기화', path: '/sync' }].find(v => v.path === location.pathname || (v.path === '/projects' && location.pathname.startsWith('/projects/')));
  return <header className="topbar"><div className="breadcrumbs"><button type="button" className="mobile-menu icon-button" onClick={openSidebar} aria-label="메뉴 열기"><Menu size={21} /></button><strong>{item?.label ?? 'Home'}</strong></div><div className="header-actions"><span className="sample-pill">v0.3</span>{account?.local && <NavLink to="/sync" className="sync-status" aria-label={`Cloud 동기화: ${syncLabel(state)}`} title={syncLabel(state)}><RefreshCw size={16} /><span>{syncLabel(state)}</span></NavLink>}<NavLink className="search-trigger" to="/search" aria-label="Workspace 검색"><Search size={18} /><span>검색</span></NavLink></div></header>;
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false); const drawer = useRef<HTMLDivElement>(null); const opener = useRef<HTMLElement | null>(null);
  const location = useLocation(); const navigate = useNavigate();
  useEffect(() => {
    if (!isAndroid) return;
    return registerBackHandler(10, () => {
      if (location.pathname === '/') return false;
      if (Number(window.history.state?.idx) > 0) navigate(-1);
      else navigate('/', { replace: true });
      return true;
    });
  }, [location.pathname, navigate]);
  useEffect(() => {
    if (!isAndroid || !menuOpen) return;
    return registerBackHandler(50, () => { setMenuOpen(false); return true; });
  }, [menuOpen]);
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
  if (error && !loaded) return <div className="card error" role="alert"><p>{error}</p><button type="button" onClick={() => void reload()}>다시 시도</button>{!auth.account?.local && <button type="button" onClick={() => void auth.signOut()}>로그아웃</button>}</div>;
  return <>{auth.account?.local_only && <p className="notice">기존 로컬 기록을 그대로 사용할 수 있습니다. <NavLink to="/account">계정 연결</NavLink>은 나중에 진행해도 됩니다.</p>}{error && <div className="error" role="alert"><p>{error}</p><button type="button" onClick={() => void reload()}>다시 시도</button></div>}{auth.error && <p className="error" role="alert">{auth.error}</p>}<Routes><Route path="/" element={<HomePage />} /><Route path="/today" element={<TodayPage />} /><Route path="/inbox" element={<InboxPage />} /><Route path="/tasks" element={<TasksPage />} /><Route path="/notes" element={<NotesPage />} /><Route path="/calendar" element={<CalendarPage />} /><Route path="/projects" element={<ProjectsPage />} /><Route path="/projects/:id" element={<ProjectDetailPage />} /><Route path="/library" element={<LibraryPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/account" element={auth.account?.local ? <NativeAccountPage /> : <Navigate to="/" replace />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/search" element={<SearchPage />} /><Route path="/sync" element={auth.account?.local ? <SyncPage /> : <Navigate to="/" replace />} /><Route path="/cloud-import" element={auth.account?.local ? <CloudImportPage /> : <Navigate to="/" replace />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></>;
}
function NativeAccountPage() { const navigate = useNavigate(); return <AuthPage connecting onLater={() => navigate('/profile')} />; }
function AuthGate() {
  const auth = useAuth();
  if (auth.loading) return <main className="auth-screen"><div className="card" role="status">{isNative ? 'Local Workspace를 여는 중…' : '로그인 상태를 확인하는 중…'}</div></main>;
  if (!auth.account && isNative && auth.error) return <main className="auth-screen"><div className="card" role="alert"><p>{auth.error}</p><button onClick={auth.retry}>다시 시도</button></div></main>;
  if (!auth.account) return <AuthPage />;
  return <WorkspaceProvider key={auth.account.id} account={auth.account}><Shell /></WorkspaceProvider>;
}
export function App() { return <AuthProvider><AuthGate /></AuthProvider>; }

