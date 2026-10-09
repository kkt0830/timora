import { SupabaseAuth } from '../data/supabase-auth.ts';
import { SupabaseRepository } from '../data/supabase-repository.ts';
import type { BackendConfig } from '../data/http.ts';
import type { WorkspaceData } from '../domain/models.ts';

// An import-only login. Never persisted to localStorage, SQLite or logs.
function transientStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
}
export class CloudImportService {
  private storage = transientStorage();
  private auth: SupabaseAuth;
  private repository: SupabaseRepository;
  constructor(config: BackendConfig) {
    // Reuse the public key security boundary; never accept admin credentials.
    const url = new URL(config.url);
    if (url.protocol !== 'https:' || !config.publishableKey.startsWith('sb_publishable_')) throw new Error('Supabase HTTPS URL과 Publishable key가 필요합니다.');
    this.auth = new SupabaseAuth(config, this.storage); this.repository = new SupabaseRepository(config, this.auth);
  }
  async preview(email: string, password: string): Promise<{ userId: string; data: WorkspaceData }> {
    try {
      await this.auth.signIn(email, password);
      const account = await this.auth.restore();
      if (!account) throw new Error('Cloud 로그인 상태를 확인해 주세요.');
      const data = await this.repository.load(account.id);
      // Old accounts with no settings row must still import a valid dated snapshot.
      if (!data.settings.updated_at) data.settings.updated_at = new Date().toISOString();
      return { userId: account.id, data };
    } finally { await this.auth.signOut().catch(() => {}); this.storage.clear(); }
  }
}
