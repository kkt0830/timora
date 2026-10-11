import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Account } from '../services/contracts';
import { NativeProfileProvider } from './NativeProfileProvider';
import { createBackend } from '../services/backend';
import { emptyWorkspace } from '../domain/models';
import type { EntityInput, EntityTable, WorkspaceData, WorkspaceSettings } from '../domain/models';
import { emptySyncState } from '../services/cloud-sync';
import type { SyncState } from '../services/cloud-sync';

const backend = createBackend();
const syncService = 'sync' in backend ? backend.sync : null;
export const messageOf = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
interface AuthState {
  account: Account | null; loading: boolean; error: string; configured: boolean;
  retry: () => void; signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nickname?: string) => Promise<boolean>; signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
let initialRestore: Promise<Account | null> | undefined;
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(Boolean(backend.auth));
  const [error, setError] = useState(backend.error);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const auth = backend.auth;
    if (!auth) return;
    let active = true;
    setLoading(true); setError('');
    const unsubscribe = auth.subscribe(user => { if (active) { syncService?.setAccount(user); setAccount(user); setError(''); } });
    const promise = attempt ? auth.restore() : (initialRestore ??= auth.restore());
    void promise.then(user => { if (active) setAccount(user); }).catch(e => { if (active) setError(messageOf(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; unsubscribe(); };
  }, [attempt]);
  useEffect(() => {
    if (!account || account.local_only || !backend.auth) return;
    const refresh = () => { if (document.visibilityState === 'visible') void backend.auth!.token().catch(e => { if (!account.local) setError(messageOf(e)); }); };
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [account?.id]);
  const value: AuthState = {
    account, loading, error, configured: Boolean(backend.auth), retry: () => setAttempt(v => v + 1),
    signIn: async (email, password) => { if (!backend.auth) throw new Error(backend.error); await backend.auth.signIn(email, password); },
    signUp: async (email, password, nickname) => { if (!backend.auth) throw new Error(backend.error); return backend.auth.signUp(email, password, nickname); },
    signOut: async () => {
      if (account?.local && !window.confirm('로그아웃할까요? 이 기기의 기록과 사진은 그대로 보관됩니다. 다시 열려면 같은 계정으로 인터넷에 연결하여 로그인해야 합니다. 다른 계정으로는 이 Workspace를 열 수 없습니다.')) return;
      try { await backend.auth?.signOut(); } catch (e) { setError(messageOf(e)); }
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider required'); return value; }

interface WorkspaceState {
  data: WorkspaceData; loading: boolean; loaded: boolean; error: string; busy: boolean;
  reload: () => Promise<void>;
  save: <K extends EntityTable>(table: K, input: EntityInput<K>, id?: string) => Promise<void>;
  remove: (table: EntityTable, id: string) => Promise<void>;
  convert: (id: string, target: 'task' | 'note') => Promise<void>;
  saveSettings: (settings: WorkspaceSettings) => Promise<void>;
}
const WorkspaceContext = createContext<WorkspaceState | null>(null);
const SyncContext = createContext<{ state: SyncState; retry: () => void; resolve: (table: string, id: string, choice: 'local' | 'cloud') => Promise<void> } | null>(null);
export function WorkspaceProvider({ account, children }: { account: Account; children: ReactNode }) {
  const repository = backend.repository!;
  const [data, setData] = useState(() => emptyWorkspace(account.id));
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(emptySyncState);
  const mounted = useRef(false);
  const generation = useRef(0);
  const lock = useRef(false);
  const reload = useCallback(async (showLoading = true) => {
    const version = ++generation.current;
    if (showLoading) setLoading(true); setError('');
    try { const next = await repository.load(account.id);
      if (!next.settings.display_name && typeof account.user_metadata?.display_name === 'string') next.settings.display_name = account.user_metadata.display_name.slice(0, 64);
      if (mounted.current && version === generation.current) { setData(next); setLoaded(true); } }
    catch (e) { if (mounted.current && version === generation.current) setError(messageOf(e)); }
    finally { if (mounted.current && version === generation.current) setLoading(false); }
  }, [account.id, account.user_metadata?.display_name, repository]);
  useEffect(() => { mounted.current = true; void reload(); return () => { mounted.current = false; generation.current++; }; }, [reload, account.cloud_user_id, account.email, account.local_only]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && !lock.current) void reload(false); };
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    const interval = account.local ? undefined : window.setInterval(refresh, 30000);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); if (interval) window.clearInterval(interval); };
  }, [reload]);
  useEffect(() => {
    if (!syncService) return;
    syncService.setAccount(account);
    let lastRefresh: string | null = null;
    const unsubscribe = syncService.subscribe(state => {
      setSyncState(state);
      if (state.phase === 'idle' && state.last_success && state.last_success !== lastRefresh && !lock.current) { lastRefresh = state.last_success; void reload(false); }
    });
    const wake = () => { if (document.visibilityState === 'visible') void syncService.wake(); };
    const offline = () => { void syncService.wake(); };
    wake(); const interval = window.setInterval(wake, 30000);
    window.addEventListener('online', wake); window.addEventListener('offline', offline); window.addEventListener('focus', wake); document.addEventListener('visibilitychange', wake);
    return () => { unsubscribe(); syncService.stop(); window.clearInterval(interval); window.removeEventListener('online', wake); window.removeEventListener('offline', offline); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [account.id, account.cloud_user_id, account.local_only, reload]);
  const mutate = async (action: () => Promise<void>) => {
    if (lock.current) throw new Error('저장 중입니다. 잠시 기다려 주세요.');
    lock.current = true; setBusy(true);
    // Invalidate any older load so it cannot overwrite the result of this mutation.
    generation.current++;
    try { await action(); } finally { lock.current = false; if (mounted.current) { setBusy(false); setLoading(false); void syncService?.wake(); } }
  };
  const value: WorkspaceState = {
    data, loading, loaded, error, busy, reload,
    save: async (table, input, id) => mutate(async () => {
      const row = await repository.save(table, account.id, input, id);
      if (mounted.current) setData(previous => ({ ...previous, [table]: [row, ...previous[table].filter(item => item.id !== row.id)] }));
    }),
    remove: async (table, id) => mutate(async () => {
      await repository.remove(table, account.id, id);
      if (!mounted.current) return;
      setData(previous => {
        const next = { ...previous, [table]: previous[table].filter(item => item.id !== id) };
        if (table === 'projects') {
          next.tasks = previous.tasks.map(t => t.project_id === id ? { ...t, project_id: null } : t);
          next.notes = previous.notes.map(t => t.project_id === id ? { ...t, project_id: null } : t);
          next.events = previous.events.map(t => t.project_id === id ? { ...t, project_id: null } : t);
          next.library_items = previous.library_items.map(t => t.project_id === id ? { ...t, project_id: null } : t);
        }
        return next;
      });
    }),
    convert: async (id, target) => mutate(async () => { await repository.convertInbox(account.id, id, target); if (mounted.current) await reload(false); }),
    saveSettings: async settings => mutate(async () => { const next = await repository.saveSettings(settings); if (mounted.current) setData(previous => ({ ...previous, settings: next })); }),
  };
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => { document.documentElement.dataset.theme = data.settings.appearance === 'system' ? (media.matches ? 'dark' : 'light') : data.settings.appearance; };
    update(); media.addEventListener('change', update);
    return () => { media.removeEventListener('change', update); delete document.documentElement.dataset.theme; };
  }, [data.settings.appearance]);
  const sync = { state: syncState, retry: () => { void syncService?.wake(); }, resolve: async (table: string, id: string, choice: 'local' | 'cloud') => { if (!syncService) throw new Error('동기화 설정이 없습니다.'); await syncService.resolve(table, id, choice); await reload(false); } };
  return <WorkspaceContext.Provider value={value}><SyncContext.Provider value={sync}><NativeProfileProvider account={account}>{children}</NativeProfileProvider></SyncContext.Provider></WorkspaceContext.Provider>;
}
export function useWorkspace() { const value = useContext(WorkspaceContext); if (!value) throw new Error('WorkspaceProvider required'); return value; }
export function useSync() { const value = useContext(SyncContext); if (!value) throw new Error('WorkspaceProvider required'); return value; }
