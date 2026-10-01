import type { AuthService, WorkspaceRepository } from '../services/contracts.ts';
import { emptyWorkspace, entityTables } from '../domain/models.ts';
import type { EntityInput, EntityMap, EntityTable, WorkspaceData, WorkspaceSettings } from '../domain/models.ts';
import { validateInput } from '../domain/validation.ts';
import { apiRequest, ApiError } from './http.ts';
import type { BackendConfig } from './http.ts';

export class SupabaseRepository implements WorkspaceRepository {
  private config: BackendConfig;
  private auth: AuthService;
  constructor(config: BackendConfig, auth: AuthService) { this.config = config; this.auth = auth; }
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.auth.token();
    try { return await apiRequest<T>(this.config, `/rest/v1/${path}`, init, token); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      return apiRequest<T>(this.config, `/rest/v1/${path}`, init, await this.auth.token(true));
    }
  }
  async load(userId: string): Promise<WorkspaceData> {
    const data = emptyWorkspace(userId);
    const rows = await Promise.all(entityTables.map(table => this.request(`${table}?user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&select=*`)));
    entityTables.forEach((table, index) => { Object.assign(data, { [table]: rows[index] }); });
    const settings = await this.request<WorkspaceSettings[]>(`workspace_settings?user_id=eq.${encodeURIComponent(userId)}&select=*`);
    if (settings[0]) data.settings = settings[0];
    return data;
  }
  async save<K extends EntityTable>(table: K, userId: string, input: EntityInput<K>, id?: string): Promise<EntityMap[K]> {
    validateInput(table, input);
    const query = id ? `?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}` : '';
    const rows = await this.request<EntityMap[K][]>(`${table}${query}`, { method: id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...input, user_id: userId }) });
    if (!rows[0]) throw new Error('항목이 없거나 수정 권한이 없습니다. 새로고침해 주세요.');
    return rows[0];
  }
  async remove(table: EntityTable, userId: string, id: string): Promise<void> {
    const rows = await this.request<{ id: string }[]>(`${table}?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=id`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    if (!rows.length) throw new Error('항목이 없거나 삭제 권한이 없습니다. 새로고침해 주세요.');
  }
  async convertInbox(_userId: string, id: string, target: 'task' | 'note'): Promise<void> {
    await this.request('rpc/convert_inbox', { method: 'POST', body: JSON.stringify({ item_id: id, target_kind: target }) });
  }
  async saveSettings(settings: WorkspaceSettings): Promise<WorkspaceSettings> {
    const name = settings.workspace_name.trim();
    if (!name || name.length > 80) throw new Error('Workspace 이름은 1~80자로 입력해 주세요.');
    const rows = await this.request<WorkspaceSettings[]>('workspace_settings?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: settings.user_id, workspace_name: name, appearance: settings.appearance }) });
    if (!rows[0]) throw new Error('설정을 저장하지 못했습니다.');
    return rows[0];
  }
}
