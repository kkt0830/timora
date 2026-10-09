import { useState } from 'react';
import type { FormEvent } from 'react';
import { messageOf, useAuth } from './providers';
import { isNative } from '../services/runtime';

export function AuthPage({ connecting = false, onLater }: { connecting?: boolean; onLater?: () => void } = {}) {
  const auth = useAuth();
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const values = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      if (connecting && auth.account?.local_only && !window.confirm('이 기기의 기존 기록을 이 계정에 연결할까요? 기록은 삭제되거나 Cloud로 업로드되지 않습니다. 연결 후에는 같은 계정으로만 이 Workspace를 열 수 있습니다.')) return;
      const email = String(values.get('email')).trim(); const password = String(values.get('password'));
      if (signup) {
        const signedIn = await auth.signUp(email, password, String(values.get('nickname') ?? ''));
        if (signedIn) onLater?.();
        if (!signedIn) setNotice('이메일의 확인 링크를 열어 가입을 완료한 뒤 로그인해 주세요. 메일이 오지 않으면 기존 계정 여부와 Supabase 메일 설정을 확인해 주세요.');
      } else { await auth.signIn(email, password); onLater?.(); }
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  return <main className={connecting ? 'account-connect' : 'auth-screen'}><section className="card auth-card"><div className="brand"><div className="brand-symbol"><span /></div><div><strong>timora</strong><small>your personal space</small></div></div><h1>{signup ? '나만의 Workspace 시작하기' : '다시 나의 흐름으로'}</h1><p>나의 일상과 시간, 기록과 작업을 하나의 흐름으로.</p>{!auth.configured ? <div className="notice"><strong>연결 준비 중</strong><p>{auth.error}</p><p>설정 방법은 저장소의 docs/development.md에서 확인할 수 있습니다. Supabase 연결 후 계정을 만들고 데이터를 저장할 수 있습니다.</p></div> : <>{isNative && <p className="muted">{connecting ? 'Cloud 연결이 필요할 때만 다시 로그인하세요. 로컬 기록은 계속 사용할 수 있습니다.' : '처음 로그인에는 인터넷이 필요합니다. 로그인 후 이 기기의 기록은 오프라인에서도 사용할 수 있습니다.'}</p>}<form onSubmit={submit}><fieldset disabled={busy}>{signup && <label>닉네임<input name="nickname" maxLength={64} required autoComplete="nickname" /></label>}<label>이메일<input name="email" type="email" autoComplete="email" required /></label><label>비밀번호<input name="password" type="password" minLength={signup ? 8 : undefined} autoComplete={signup ? 'new-password' : 'current-password'} required /></label><button className="primary-button" type="submit">{busy ? '처리 중…' : signup ? '회원가입' : '로그인'}</button></fieldset></form><button className="text-link" type="button" disabled={busy} onClick={() => { setSignup(!signup); setError(''); setNotice(''); }}>{signup ? '기존 계정으로 로그인' : '새 계정 만들기'}</button>{auth.error && <div role="alert" className="error"><p>{auth.error}</p><button type="button" onClick={auth.retry}>연결 다시 확인</button></div>}</>}{error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}{onLater && <button type="button" disabled={busy} onClick={onLater}>나중에 · 로컬 기록으로 돌아가기</button>}<small>Timora v0.3 · 개인 Workspace</small></section></main>;
}
