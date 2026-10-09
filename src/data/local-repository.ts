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
  private epoch = 0;
  private listeners = new Set<(account: Account | null) => void>();
  constructor(invoke: LocalInvoke, config?: BackendConfig) { this.invoke = invoke; if (config) this.cloud = new SupabaseAuth(config, this.storage, { useSiteUrl: true }); }
  private publish(): Account | null {
    if (this.account) this.account = { ...this.account, cloud_state: this.account.local_only || !this.account.cloud_user_id ? 'LOCAL_ONLY'
      : typeof navigator !== 'undefined' && navigator.onLine === false ? 'SIGNED_IN_OFFLINE' : this.hasSession ? 'SIGNED_IN_ONLINE' : 'CLOUD_REAUTH_REQUIRED' };
    this.listeners.forEach(listener => listener(this.account)); return this.account;
  }
  async restore(): Promise<Account | null> { const version = this.epoch; const account = await this.invoke<Account | null>('local_account'); if (version !== this.epoch) return this.account; this.account = account; return this.publish(); }
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
    this.account = account; this.hasSession = true; this.publish();
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
    this.account = null; this.hasSession = false; this.publish();
    try { await this.cloud?.signOut(); } catch { /* Remote logout is best effort; the local lock is already durable. */ } finally { if (version === this.epoch) this.storage.clear(); }
  }
  async token(forceRefresh = false): Promise<string> {
    const version = this.epoch;
    try { const token = await this.configured().token(forceRefresh); if (version === this.epoch) { this.hasSession = true; this.publish(); } return token; }
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
