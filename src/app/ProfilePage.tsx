import { useState } from 'react';
import type { FormEvent } from 'react';
import { Avatar, Button } from '../design/components';
import { displayName, safeAvatarUrl } from '../domain/identity';
import { PageTitle } from './components';
import { messageOf, useAuth, useWorkspace } from './providers';
export function ProfilePage() {
  const { account } = useAuth(); const { data, saveSettings, busy } = useWorkspace();
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [avatar, setAvatar] = useState(data.settings.avatar_url ?? '');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const name = displayName(String(form.get('display_name'))); const url = avatar.trim();
      if (url && !safeAvatarUrl(url)) throw new Error('HTTPS 이미지 URL을 입력해 주세요.');
      await saveSettings({ ...data.settings, display_name: name, avatar_url: url || null }); setNotice('프로필을 저장했습니다.');
    } catch (e) { setError(messageOf(e)); }
  }
  return <div className="profile-page"><PageTitle eyebrow="IDENTITY" title="Profile" description="Workspace에서 사용할 이름과 사진을 관리하세요." /><section className="card"><div className="profile-summary"><Avatar name={data.settings.display_name || account?.email || 'Timora'} url={avatar} /><div><h2>{data.settings.display_name || '나의 프로필'}</h2><p>{account?.email}</p></div></div><form onSubmit={submit}><fieldset disabled={busy}><label>닉네임<input name="display_name" defaultValue={data.settings.display_name} required maxLength={64} autoComplete="nickname" /></label><label>프로필 사진 URL<input type="url" value={avatar} onChange={e => setAvatar(e.target.value)} maxLength={2048} placeholder="https://…" /></label><p className="muted">HTTPS 이미지 URL을 사용합니다. 파일 업로드는 후속 버전입니다. 외부 이미지 제공자에게 이미지 요청이 전달됩니다.</p><div className="dialog-actions"><Button onClick={() => setAvatar('')}>사진 제거</Button><Button type="submit" variant="primary">{busy ? '저장 중…' : '프로필 저장'}</Button></div></fieldset></form>{error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}</section></div>;
}
