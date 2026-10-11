import type { Account, AuthService } from './contracts.ts';
import type { LocalInvoke } from '../data/local-repository.ts';
import { apiRequest, ApiError } from '../data/http.ts';
import type { BackendConfig } from '../data/http.ts';

export interface SyncConflict { entity_table: string; id: string; local: Record<string, unknown> | null; remote: { deleted: boolean; payload: Record<string, unknown> | null; revision: string } }
export interface SyncSnapshot { pending: number; conflict_count: number; conflicts: SyncConflict[]; cursor: string; last_success: string | null }
export interface SyncState extends SyncSnapshot { phase: 'idle' | 'syncing' | 'offline' | 'local_only' | 'auth_required' | 'error'; error: string }
interface Operation { operation_id: string; entity_table: string; id: string; action: string; payload: unknown; base_revision: string | null; base_updated_at: string | null }
interface Page { records: unknown[]; dependencies: unknown[]; cursor: string; has_more: boolean }
export const emptySyncState: SyncState = { pending: 0, conflict_count: 0, conflicts: [], cursor: '0', last_success: null, phase: 'idle', error: '' };

// Foreground automatic sync: never block local writes or discard an unacknowledged operation.
// One cycle at a time; resume/online/local writes wake it, polling receives other devices.
export class CloudSyncService {
  private account: Account | null = null;
  private state: SyncState = { ...emptySyncState };
  private listeners = new Set<(state: SyncState) => void>();
  private flight: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private generation = 0;
  private again = false;
  private config: BackendConfig;
  private auth: AuthService;
  private invoke: LocalInvoke;
  constructor(config: BackendConfig, auth: AuthService, invoke: LocalInvoke) { this.config = config; this.auth = auth; this.invoke = invoke; }
  subscribe(listener: (state: SyncState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private publish(next: Partial<SyncState>) { this.state = { ...this.state, ...next }; this.listeners.forEach(fn => fn(this.state)); }
  setAccount(account: Account | null) {
    if (this.account?.id !== account?.id || this.account?.cloud_user_id !== account?.cloud_user_id || this.account?.local_only !== account?.local_only || Boolean(this.account) !== Boolean(account)) { this.generation++; this.controller?.abort(); this.flight = null; this.again = false; this.publish({ ...emptySyncState }); }
    this.account = account;
  }
  stop() { this.generation++; this.account = null; this.controller?.abort(); this.flight = null; this.again = false; }
  async status() {
    if (!this.account) return;
    const version = this.generation;
    const snapshot = await this.invoke<SyncSnapshot>('local_sync_status');
    if (version === this.generation) this.publish(snapshot);
  }
  async resolve(table: string, id: string, choice: 'local' | 'cloud') {
    const cloudUserId = this.account?.cloud_user_id;
    if (!cloudUserId) throw new Error('먼저 계정을 연결해 주세요.');
    await this.invoke('local_sync_resolve', { cloudUserId, table, id, choice });
    await this.status(); void this.wake();
  }
  wake(): Promise<void> {
    if (this.flight) { this.again = true; return this.flight; }
    const account = this.account;
    if (!account) return Promise.resolve();
    const version = this.generation;
    this.controller = new AbortController(); const signal = this.controller.signal;
    const current = () => version === this.generation && !signal.aborted && this.account?.id === account.id;
    const run = async () => {
      await this.status(); if (!current()) return;
      if (account.local_only || !account.cloud_user_id) { this.publish({ phase: 'local_only', error: '' }); return; }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.publish({ phase: 'offline', error: '' }); return; }
      this.publish({ phase: 'syncing', error: '' });
      const token = await this.auth.token(); if (!current()) return;
      // Validate actual token ownership before any upload, including restored credentials.
      const user = await apiRequest<{ id: string }>(this.config, '/auth/v1/user', { signal }, token);
      if (user.id !== account.cloud_user_id) throw new ApiError('연결한 계정으로 다시 인증해 주세요.', 401);
      const request = async <T>(name: string, body: unknown): Promise<T> => {
        if (!current()) throw new ApiError('동기화가 중단되었습니다.', 0);
        try { return await apiRequest<T>(this.config, `/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(body), signal }, await this.auth.token()); }
        catch (error) { if (!(error instanceof ApiError) || error.status !== 401 || !current()) throw error; return apiRequest<T>(this.config, `/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(body), signal }, await this.auth.token(true)); }
      };
      // Push first: a lost acknowledgement retries its receipt before pull can call it a conflict.
      for (let delivered = 0; current() && delivered < 200; delivered++) {
        const operation = await this.invoke<Operation | null>('local_sync_next', { cloudUserId: account.cloud_user_id });
        if (!operation) break;
        const response = await request('sync_apply', { operation_id: operation.operation_id, entity_table: operation.entity_table, entity_id: operation.id, action: operation.action, payload: operation.payload, base_revision: operation.base_revision, base_updated_at: operation.base_updated_at });
        if (!current()) return;
        await this.invoke('local_sync_ack', { cloudUserId: account.cloud_user_id, operationId: operation.operation_id, response });
      }
      for (let batches = 0; current() && batches < 50; batches++) {
        const snapshot = await this.invoke<SyncSnapshot>('local_sync_status');
        const page = await request<Page>('sync_pull', { after_revision: snapshot.cursor, batch_size: 200 });
        if (!current()) return;
        await this.invoke('local_sync_page', { cloudUserId: account.cloud_user_id, after: snapshot.cursor, page });
        if (!page.has_more) break;
      }
      if (current()) { await this.status(); if (current()) this.publish({ phase: 'idle', error: '' }); }
    };
    const flight = run().catch(error => {
      if (!current()) return;
      const auth = error instanceof ApiError && [400, 401, 403].includes(error.status);
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      this.publish({ phase: offline ? 'offline' : auth ? 'auth_required' : 'error', error: offline ? '' : error instanceof Error ? error.message : '동기화를 완료하지 못했습니다. 로컬 변경은 보관됩니다.' });
    }).finally(() => {
      if (this.flight !== flight) return;
      this.flight = null;
      // A local mutation during the cycle needs another pass, but errors never hot-loop.
      const repeat = this.again && this.state.phase === 'idle'; this.again = false;
      if (repeat && current()) queueMicrotask(() => { void this.wake(); });
    });
    this.flight = flight; return flight;
  }
}
