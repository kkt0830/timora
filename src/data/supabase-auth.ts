import { displayName } from '../domain/identity.ts';
import type { Account, AuthService } from '../services/contracts.ts';
import { apiRequest, ApiError } from './http.ts';
import type { BackendConfig } from './http.ts';

interface Session { access_token: string; refresh_token: string; expires_at: number; user: Account }
interface TokenResponse { access_token: string; refresh_token: string; expires_in: number; user: Account }

// Supabase Auth HTTP adapter. No password or application data is persisted here.
export class SupabaseAuth implements AuthService {
  private config: BackendConfig;
  private storage: Storage;
  private key: string;
  private session: Session | null = null;
  private epoch = 0;
  private listeners = new Set<(account: Account | null) => void>();
  private refreshing: { epoch: number; promise: Promise<string> } | null = null;
  private useSiteUrl: boolean;

  constructor(config: BackendConfig, storage: Storage, options: { useSiteUrl?: boolean } = {}) {
    this.config = config; this.storage = storage; this.key = `timora.auth.${config.url}`;
    this.useSiteUrl = options.useSiteUrl ?? false;
  }
  private read(): Session | null {
    try {
      const row = JSON.parse(this.storage.getItem(this.key) ?? 'null') as Session | null;
      return row && typeof row.access_token === 'string' && typeof row.refresh_token === 'string' && Number.isFinite(row.expires_at) && typeof row.user?.id === 'string' ? row : null;
    } catch { return null; }
  }
  private setSession(session: Session | null): void {
    // Storage failure must be visible: claiming persistence would be misleading.
    if (session) this.storage.setItem(this.key, JSON.stringify(session));
    else this.storage.removeItem(this.key);
    this.session = session;
    this.listeners.forEach(listener => listener(session?.user ?? null));
  }
  private accept(data: TokenResponse): void {
    if (!data.access_token || !data.refresh_token || !data.user?.id || !Number.isFinite(data.expires_in)) throw new Error('인증 응답이 올바르지 않습니다.');
    this.setSession({ ...data, expires_at: Date.now() / 1000 + data.expires_in });
  }
  async restore(): Promise<Account | null> {
    const version = this.epoch;
    const hash = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.hash.slice(1));
    if (hash.has('access_token') || hash.has('error_description')) {
      if (typeof history !== 'undefined') history.replaceState(null, '', location.pathname + location.search);
      if (hash.has('error_description')) throw new Error(hash.get('error_description') ?? '이메일 확인에 실패했습니다.');
      const access_token = hash.get('access_token')!;
      const user = await apiRequest<Account>(this.config, '/auth/v1/user', {}, access_token);
      if (version !== this.epoch) return this.session?.user ?? null;
      this.accept({ access_token, refresh_token: hash.get('refresh_token') ?? '', expires_in: Number(hash.get('expires_in')), user });
    } else {
      this.session = this.read();
      if (!this.session) return null;
      try {
        const token = await this.token();
        const user = await apiRequest<Account>(this.config, '/auth/v1/user', {}, token);
        if (version !== this.epoch) return this.session?.user ?? null;
        if (this.session && this.session.user.id === user.id) this.setSession({ ...this.session, user });
      } catch (error) {
        // A newer login/storage event owns the session; an old restore must not clear it.
        if (version !== this.epoch) return this.session?.user ?? null;
        if (error instanceof ApiError && [400, 401, 403].includes(error.status)) {
          this.epoch++; this.setSession(null); return null;
        }
        throw error;
      }
    }
    return this.session?.user ?? null;
  }
  subscribe(listener: (account: Account | null) => void): () => void {
    this.listeners.add(listener);
    const sync = (event: StorageEvent) => {
      if (event.key !== this.key && event.key !== null) return;
      this.epoch++; this.session = this.read();
      this.listeners.forEach(fn => fn(this.session?.user ?? null));
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', sync);
    return () => { this.listeners.delete(listener); if (typeof window !== 'undefined') window.removeEventListener('storage', sync); };
  }
  async signIn(email: string, password: string): Promise<void> {
    const version = ++this.epoch;
    const data = await apiRequest<TokenResponse>(this.config, '/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (version === this.epoch) this.accept(data);
  }
  async signUp(email: string, password: string, nickname?: string): Promise<boolean> {
    const version = ++this.epoch;
    const redirect = this.useSiteUrl || typeof location === 'undefined' ? '' : `?redirect_to=${encodeURIComponent(location.origin)}`;
    const data = await apiRequest<Partial<TokenResponse>>(this.config, `/auth/v1/signup${redirect}`, { method: 'POST', body: JSON.stringify({ email, password, ...(nickname ? { data: { display_name: displayName(nickname) } } : {}) }) });
    if (data.access_token && version === this.epoch) { this.accept(data as TokenResponse); return true; }
    return false;
  }
  async signOut(): Promise<void> {
    const token = this.session?.access_token;
    this.epoch++;
    this.setSession(null); // Clear this device even if the network is unavailable.
    if (token) await apiRequest(this.config, '/auth/v1/logout?scope=local', { method: 'POST' }, token);
  }
  async token(forceRefresh = false): Promise<string> {
    if (this.refreshing?.epoch === this.epoch) return this.refreshing.promise;
    // A valid newer account token need not wait for another account's Web Lock.
    const current = this.read();
    if (!forceRefresh && current && current.expires_at > Date.now() / 1000 + 60) {
      this.session = current; return current.access_token;
    }
    const version = this.epoch;
    const run = async (): Promise<string> => {
      if (version !== this.epoch) throw new ApiError('세션이 변경되었습니다. 다시 시도해 주세요.', 401);
      const stored = this.read();
      if (!stored) throw new ApiError('로그인이 필요합니다.', 401);
      const updatedElsewhere = stored.access_token !== this.session?.access_token;
      this.session = stored;
      if ((!forceRefresh || updatedElsewhere) && stored.expires_at > Date.now() / 1000 + 60) return stored.access_token;
      try {
        const data = await apiRequest<TokenResponse>(this.config, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: stored.refresh_token }) });
        if (version !== this.epoch) throw new ApiError('세션이 변경되었습니다. 다시 시도해 주세요.', 401);
        this.accept(data); return data.access_token;
      } catch (error) {
        if (version === this.epoch && error instanceof ApiError && [400, 401, 403].includes(error.status)) { this.epoch++; this.setSession(null); }
        throw error;
      }
    };
    // Refresh-token rotation is serialized across tabs when Web Locks is supported.
    const pending = { epoch: this.epoch, promise: typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(this.key, { signal: AbortSignal.timeout(15000) }, run)
      : run() };
    this.refreshing = pending;
    try { return await pending.promise; } finally { if (this.refreshing === pending) this.refreshing = null; }
  }
}
