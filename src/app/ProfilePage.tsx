import { useState } from 'react';
import type { FormEvent } from 'react';
import { Avatar, Button } from '../design/components';
import { displayName, safeAvatarUrl } from '../domain/identity';
import { PageTitle } from './components';
import { messageOf, useAuth, useWorkspace } from './providers';
import { useNativeProfile } from './NativeProfileProvider';
import { NavLink } from 'react-router-dom';
const cloudLabels = { LOCAL_ONLY: '기존 로컬 Workspace · 계정 연결 전', SIGNED_IN_ONLINE: 'Cloud 연결됨 · 로컬 저장', SIGNED_IN_OFFLINE: '오프라인 · 로컬 저장 가능', CLOUD_REAUTH_REQUIRED: 'Cloud 재인증 필요 · 로컬 저장 가능' };
export function ProfilePage() {
  const { account } = useAuth(); const { data, saveSettings, busy } = useWorkspace();
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [avatar, setAvatar] = useState(data.settings.avatar_url ?? '');
  const nativeProfile = useNativeProfile();
  async function photo(remove: boolean) {
    setError(''); setNotice('');
    try { if (remove) { await nativeProfile?.remove(); setAvatar(''); await saveSettings({ ...data.settings, avatar_url: null }); } else await nativeProfile?.pick(); }
    catch (e) { setError(messageOf(e)); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || nativeProfile?.pending) return; setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const name = displayName(String(form.get('display_name'))); const url = avatar.trim();
      if (url && !safeAvatarUrl(url)) throw new Error('HTTPS 이미지 URL을 입력해 주세요.');
      await saveSettings({ ...data.settings, display_name: name, avatar_url: url || null }); setNotice('프로필을 저장했습니다.');
    } catch (e) { setError(messageOf(e)); }
  }
  return <div className="profile-page"><PageTitle eyebrow="IDENTITY" title="Profile" description="Workspace에서 사용할 이름과 사진을 관리하세요." /><section className="card"><div className="profile-summary"><Avatar name={data.settings.display_name || account?.email || 'Timora'} url={avatar} /><div><h2>{data.settings.display_name || '나의 프로필'}</h2><p>{account?.email || (account?.local ? '계정 연결 전' : '')}</p>{account?.local && <><p role="status">{cloudLabels[account.cloud_state || 'LOCAL_ONLY']}</p><NavLink to="/account">{account.local_only ? '계정 연결' : 'Cloud 다시 인증'}</NavLink><p className="muted">이 기기에 저장합니다. 자동 동기화는 아직 지원하지 않습니다.</p></>}</div></div><form onSubmit={submit}><fieldset disabled={busy || nativeProfile?.pending}><label>닉네임<input name="display_name" defaultValue={data.settings.display_name} required maxLength={64} autoComplete="nickname" /></label>{nativeProfile ? <><Button onClick={() => void photo(false)}>{nativeProfile.pending ? '사진 처리 중…' : '사진 선택'}</Button><p className="muted">PNG/JPEG/WebP · 최대 10 MB. 사진은 이 앱에 복사되어 원본을 지우거나 오프라인으로 사용해도 유지됩니다. Cloud로 업로드하지 않습니다.</p></> : <><label>프로필 사진 URL<input type="url" value={avatar} onChange={e => setAvatar(e.target.value)} maxLength={2048} placeholder="https://…" /></label><p className="muted">HTTPS 이미지 URL을 사용합니다. 파일 업로드는 후속 버전입니다. 외부 이미지 제공자에게 이미지 요청이 전달됩니다.</p></>}<div className="dialog-actions"><Button onClick={() => nativeProfile ? void photo(true) : setAvatar('')}>사진 제거</Button><Button type="submit" variant="primary">{busy ? '저장 중…' : '프로필 저장'}</Button></div></fieldset></form>{nativeProfile?.error && !error && <p className="error" role="alert">{nativeProfile.error}</p>}{error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}</section></div>;
}
