import { SupabaseAuth } from '../data/supabase-auth';
import { SupabaseRepository } from '../data/supabase-repository';

export function createBackend() {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
  const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (!url || !publishableKey) return { error: 'Supabase 연결 설정이 필요합니다. PC에서 .env를 설정한 뒤 다시 실행해 주세요.', auth: null, repository: null };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw new Error('URL');
    if (publishableKey.startsWith('sb_secret_')) throw new Error('Secret');
    // Legacy service_role JWT keys are forbidden in browser configuration too.
    if (publishableKey.split('.').length === 3) {
      const payload = JSON.parse(atob(publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error('Key');
    } else if (!publishableKey.startsWith('sb_publishable_')) throw new Error('Key');
    const config = { url, publishableKey };
    const auth = new SupabaseAuth(config, localStorage);
    return { error: '', auth, repository: new SupabaseRepository(config, auth) };
  } catch { return { error: 'Supabase URL 또는 공개 키 설정을 확인해 주세요. Secret/service_role 키는 브라우저에 사용할 수 없습니다.', auth: null, repository: null }; }
}
