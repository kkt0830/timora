import type { Account, AuthService, WorkspaceRepository } from '../services/contracts.ts';
import type { EntityInput, EntityMap, EntityTable, WorkspaceData, WorkspaceSettings } from '../domain/models.ts';
import { validateInput } from '../domain/validation.ts';
import { SupabaseAuth } from './supabase-auth.ts';
import type { BackendConfig } from './http.ts';
import { memoryStorage } from './memory-storage.ts';

export type LocalInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
export const desktopInvoke: LocalInvoke = async (command, args) => {
  try { const { invoke } = await import('@tauri-apps/api/core'); return await invoke(command, args); }
  catch (error) { throw new Error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Local DB 요청에 실패했습니다.'); }
};
export class LocalAuth implements AuthService {
  private invoke: LocalInvoke;
  private storage = memoryStorage();
  private cloud?: SupabaseAuth;
  private account: Account | null = null;
  private hasSession = false;
  private restoring: Promise<void> | null = null;
  private persistedRefresh: string | null = null;
  private sessionWarning = '';
  private published: string | undefined;
  private epoch = 0;
  private listeners = new Set<(account: Account | null) => void>();
  constructor(invoke: LocalInvoke, config?: BackendConfig) { this.invoke = invoke; if (config) this.cloud = new SupabaseAuth(config, this.storage, { useSiteUrl: true }); }
  private publish(): Account | null {
    if (this.account) this.account = { ...this.account, cloud_state: this.account.local_only || !this.account.cloud_user_id ? 'LOCAL_ONLY'
      : typeof navigator !== 'undefined' && navigator.onLine === false ? 'SIGNED_IN_OFFLINE' : this.hasSession ? 'SIGNED_IN_ONLINE' : 'CLOUD_REAUTH_REQUIRED' };
    if (this.account) this.account = { ...this.account, session_warning: this.sessionWarning };
    const signature = JSON.stringify(this.account);
    if (signature !== this.published) { this.published = signature; this.listeners.forEach(listener => listener(this.account)); }
    return this.account;
  }
  async restore(): Promise<Account | null> {
    const version = this.epoch; const account = await this.invoke<Account | null>('local_account');
    if (version !== this.epoch) return this.account;
    this.account = account;
    if (account?.cloud_user_id && !account.local_only && this.cloud) {
      this.restoring = this.invoke<string | null>('local_session_read').then(refresh => {
        if (version !== this.epoch || !refresh) return;
        this.cloud!.restoreCredential(refresh, account.cloud_user_id!); this.persistedRefresh = refresh;
      }).catch(() => { if (version === this.epoch) { this.sessionWarning = '보안 세션을 복원하지 못했습니다. Cloud를 다시 인증하면 됩니다. 로컬 기록은 보존됩니다.'; this.publish(); } });
    }
    // The OS vault and Cloud never delay opening this device's local workspace.
    return this.publish();
  }
  private async persist(version: number) {
    const refresh = this.cloud?.refreshCredential();
    if (!refresh || version !== this.epoch || refresh === this.persistedRefresh) return;
    try {
      await this.invoke('local_session_write', { refreshToken: refresh });
      if (version === this.epoch) { this.persistedRefresh = refresh; this.sessionWarning = ''; }
    } catch { if (version === this.epoch) this.sessionWarning = '보안 세션 저장에 실패했습니다. 이번 실행의 동기화는 가능하며 재실행 후에는 Cloud 재인증이 필요할 수 있습니다.'; }
  }
  subscribe(listener: (account: Account | null) => void): () => void {
    this.listeners.add(listener); const changed = () => { this.publish(); };
    if (typeof window !== 'undefined') { window.addEventListener('online', changed); window.addEventListener('offline', changed); }
    return () => { this.listeners.delete(listener); if (typeof window !== 'undefined') { window.removeEventListener('online', changed); window.removeEventListener('offline', changed); } };
  }
  private configured(): SupabaseAuth { if (!this.cloud) throw new Error('이 설치 파일에 Cloud 연결 설정이 없습니다. 공개 Supabase 설정을 포함한 최신 설치 파일을 사용해 주세요. 기존 로컬 기록은 보존됩니다.'); return this.cloud; }
  private async bind(version: number): Promise<void> {
    const token = await this.configured().token();
    if (version !== this.epoch) throw new Error('로그인 요청이 취소되었습니다.');
    const account = await this.invoke<Account>('local_bind_account', { accessToken: token });
    if (version !== this.epoch) return;
    this.account = account; this.hasSession = true; await this.persist(version); this.publish();
  }
  async signIn(email: string, password: string): Promise<void> {
    const version = ++this.epoch;
    try { await this.configured().signIn(email, password); await this.bind(version); }
    catch (error) { if (version === this.epoch) { this.storage.clear(); this.hasSession = false; this.publish(); } throw error; }
  }
  async signUp(email: string, password: string, nickname?: string): Promise<boolean> {
    const version = ++this.epoch;
    try { const signedIn = await this.configured().signUp(email, password, nickname); if (signedIn) await this.bind(version); return signedIn; }
    catch (error) { if (version === this.epoch) { this.storage.clear(); this.hasSession = false; this.publish(); } throw error; }
  }
  async signOut(): Promise<void> {
    const version = ++this.epoch;
    // Local logout must succeed before the UI claims the workspace is locked.
    await this.invoke('local_sign_out');
    this.account = null; this.hasSession = false; this.persistedRefresh = null; this.sessionWarning = ''; this.publish();
    try { await this.cloud?.signOut(); } catch { /* Remote logout is best effort; the local lock is already durable. */ } finally { if (version === this.epoch) this.storage.clear(); }
  }
  async token(forceRefresh = false): Promise<string> {
    const version = this.epoch;
    try {
      await this.restoring;
      if (version !== this.epoch) throw new Error('인증 요청이 취소되었습니다.');
      const token = await this.configured().token(forceRefresh);
      await this.persist(version);
      if (version === this.epoch) { this.hasSession = true; this.publish(); }
      return token;
    }
    catch (error) { if (version === this.epoch) { this.hasSession = false; this.publish(); } throw error; }
  }
}
export interface LocalInfo { id: string; cloud_user_id: string | null; imported_at: string | null; path: string }
export class LocalWorkspaceRepository implements WorkspaceRepository {
  private invoke: LocalInvoke;
  constructor(invoke: LocalInvoke) { this.invoke = invoke; }
  load(_userId: string): Promise<WorkspaceData> { return this.invoke('local_load'); }
  save<K extends EntityTable>(table: K, _userId: string, input: EntityInput<K>, id?: string): Promise<EntityMap[K]> {
    validateInput(table, input); return this.invoke('local_save', { table, input, id: id ?? null });
  }
  remove(table: EntityTable, _userId: string, id: string): Promise<void> { return this.invoke('local_remove', { table, id }); }
  convertInbox(_userId: string, id: string, target: 'task' | 'note'): Promise<void> { return this.invoke('local_convert', { id, target }); }
  saveSettings(settings: WorkspaceSettings): Promise<WorkspaceSettings> { return this.invoke('local_settings', { input: settings }); }
  importSnapshot(cloudUserId: string, snapshot: WorkspaceData): Promise<void> { return this.invoke('local_import', { cloudUserId, snapshot }); }
  info(): Promise<LocalInfo> { return this.invoke('local_info'); }
}
