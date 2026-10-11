import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { CloudImportService } from '../services/cloud-import';
import { desktopInvoke, LocalWorkspaceRepository } from '../data/local-repository';
import type { LocalInfo } from '../data/local-repository';
import type { WorkspaceData } from '../domain/models';
import { entityTables } from '../domain/models';
import { PageTitle } from './components';
import { messageOf, useAuth, useWorkspace } from './providers';

const local = new LocalWorkspaceRepository(desktopInvoke);
export function CloudImportPage() {
  const { account } = useAuth();
  const { data, reload, busy } = useWorkspace();
  const hasLocalData = entityTables.some(table => data[table].length > 0);
  const [info, setInfo] = useState<LocalInfo | null>(null); const [pending, setPending] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<{ userId: string; data: WorkspaceData } | null>(null);
  useEffect(() => { void local.info().then(setInfo).catch(e => setError(messageOf(e))); }, []);
  async function fetchPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || busy || hasLocalData || !account?.cloud_user_id || account.local_only) return;
    const form = new FormData(event.currentTarget); event.currentTarget.reset();
    setPending(true); setError(''); setNotice(''); setPreview(null);
    try { const service = new CloudImportService({ url: String(form.get('url')).trim(), publishableKey: String(form.get('key')).trim() });
      setPreview(await service.preview(String(form.get('email')).trim(), String(form.get('password')), account?.cloud_user_id));
    } catch (e) { setError(messageOf(e)); } finally { setPending(false); }
  }
  async function importData() {
    if (!preview || pending || busy || !window.confirm('빈 로컬 Workspace에 이 Cloud 기록을 가져올까요? 가져온 후 온라인이면 자동 동기화를 이어갑니다.')) return;
    setPending(true); setError('');
    try { await local.importSnapshot(preview.userId, preview.data); setPreview(null); await reload(); setInfo(await local.info()); setNotice('가져왔습니다. 온라인 연결 시 동기화가 이어집니다.'); }
    catch (e) { setError(messageOf(e)); } finally { setPending(false); }
  }
  return <><PageTitle eyebrow="LOCAL WORKSPACE" title="Cloud 가져오기" description="Cloud → Local 최초 가져오기입니다. 로컬 기록을 덮어쓰지 않는 최초 복사입니다. 일반적인 기기 간 연결은 Cloud 동기화를 사용하세요." /><section className="card"><h2>이 기기의 Workspace</h2><p className="resource-url">{info?.path ?? 'DB 위치 확인 중…'}</p><p>{info?.imported_at ? `가져오기 완료 · ${info.imported_at}` : '가져오기는 연결한 계정의 원본을 한 번 복사합니다.'}</p><NavLink to="/">Local Workspace로 시작</NavLink></section>{(!account?.cloud_user_id || account.local_only) && <p className="notice">먼저 <NavLink to="/account">계정을 연결</NavLink>해 주세요. 기존 로컬 기록은 그대로 사용할 수 있습니다.</p>}{!info?.imported_at && <section className="card">{hasLocalData && <p className="notice" role="status">로컬 기록이 있어 가져오기를 사용할 수 없습니다. 기록은 그대로 보관됩니다.</p>}<form onSubmit={fetchPreview}><fieldset disabled={pending || busy || hasLocalData || !account?.cloud_user_id || account.local_only}><label>Supabase URL<input name="url" type="url" defaultValue={import.meta.env.VITE_SUPABASE_URL ?? ''} required /></label><label>Publishable key<input name="key" defaultValue={import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''} required autoComplete="off" /></label><label>Cloud 이메일<input name="email" type="email" required autoComplete="username" /></label><label>Cloud 비밀번호<input name="password" type="password" required autoComplete="off" /></label><button className="primary-button" type="submit">{pending ? '조회 중…' : '로그인 후 미리보기'}</button></fieldset></form><p className="muted">로그인은 이 가져오기에만 사용하며 비밀번호·토큰을 저장하지 않습니다. 가입·메일 확인은 웹에서 진행하세요.</p></section>}{preview && <section className="card"><h2>가져올 기록</h2>{entityTables.map(table => <p key={table}>{table}: {preview.data[table].length}</p>)}<div className="dialog-actions"><button disabled={pending || busy} onClick={() => setPreview(null)}>취소</button><button className="primary-button" disabled={pending || busy} onClick={() => void importData()}>{pending ? '가져오는 중…' : '가져오기'}</button></div></section>}{notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}</>;
}
