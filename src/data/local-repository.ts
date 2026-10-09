import type { Account, AuthService, WorkspaceRepository } from '../services/contracts.ts';
import type { EntityInput, EntityMap, EntityTable, WorkspaceData, WorkspaceSettings } from '../domain/models.ts';
import { validateInput } from '../domain/validation.ts';

export type LocalInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
export const desktopInvoke: LocalInvoke = async (command, args) => {
  try { const { invoke } = await import('@tauri-apps/api/core'); return await invoke(command, args); }
  catch (error) { throw new Error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Local DB 요청에 실패했습니다.'); }
};
export class LocalAuth implements AuthService {
  private invoke: LocalInvoke;
  constructor(invoke: LocalInvoke) { this.invoke = invoke; }
  restore(): Promise<Account> { return this.invoke('local_account'); }
  subscribe(): () => void { return () => {}; }
  async signIn(): Promise<void> { throw new Error('Cloud 로그인은 가져오기 화면을 이용해 주세요.'); }
  async signUp(): Promise<boolean> { throw new Error('계정 가입은 Timora 웹에서 진행해 주세요.'); }
  async signOut(): Promise<void> { /* Local identity is stable and independent of Cloud login. */ }
  async token(): Promise<string> { throw new Error('로컬 Workspace는 인증 토큰을 사용하지 않습니다.'); }
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
