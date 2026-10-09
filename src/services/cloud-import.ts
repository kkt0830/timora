import { SupabaseAuth } from '../data/supabase-auth.ts';
import { SupabaseRepository } from '../data/supabase-repository.ts';
import type { BackendConfig } from '../data/http.ts';
import type { WorkspaceData } from '../domain/models.ts';
import { memoryStorage } from '../data/memory-storage.ts';

// An import-only login. Never persisted to localStorage, SQLite or logs.
export class CloudImportService {
  private storage = memoryStorage();
  private auth: SupabaseAuth;
  private repository: SupabaseRepository;
  constructor(config: BackendConfig) {
    // Reuse the public key security boundary; never accept admin credentials.
    const normalized = { ...config, url: config.url.trim().replace(/\/+$/, '') };
    const url = new URL(normalized.url);
    if (url.protocol !== 'https:' || !config.publishableKey.startsWith('sb_publishable_')) throw new Error('Supabase HTTPS URL과 Publishable key가 필요합니다.');
    this.auth = new SupabaseAuth(normalized, this.storage); this.repository = new SupabaseRepository(normalized, this.auth);
  }
  async preview(email: string, password: string, expectedUserId?: string): Promise<{ userId: string; data: WorkspaceData }> {
    try {
      await this.auth.signIn(email, password);
      const account = await this.auth.restore();
      if (!account) throw new Error('Cloud 로그인 상태를 확인해 주세요.');
      if (expectedUserId && account.id !== expectedUserId) throw new Error('이 Workspace에 연결한 계정으로 가져오기를 진행해 주세요. 다른 계정의 기록은 조회하지 않았습니다.');
      const data = await this.repository.load(account.id);
      // Old accounts with no settings row must still import a valid dated snapshot.
      if (!data.settings.updated_at) data.settings.updated_at = new Date().toISOString();
      return { userId: account.id, data };
    } finally { await this.auth.signOut().catch(() => {}); this.storage.clear(); }
  }
}
