import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { PageTitle } from './components';
import { useAuth, useSync, messageOf } from './providers';
import { Button } from '../design/components';
export function syncLabel(state: ReturnType<typeof useSync>['state']): string {
  if (state.phase === 'local_only') return '계정 연결 전';
  if (state.phase === 'auth_required') return 'Cloud 재인증 필요';
  if (state.phase === 'offline') return `오프라인 · 전송 대기 ${state.pending}개`;
  if (state.phase === 'syncing') return '동기화 중…';
  if (state.phase === 'error') return '동기화 재시도 필요';
  if (state.failed_count) return `전송 실패 확인 ${state.failed_count}개`;
  if (state.conflict_count) return `충돌 확인 ${state.conflict_count}개`;
  if (state.pending) return `전송 대기 ${state.pending}개`;
  return state.last_success ? '동기화 완료' : '동기화 준비';
}
export function SyncPage() {
  const { state, retry, retryFailed, resolve } = useSync(); const { account } = useAuth();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function choose(table: string, id: string, choice: 'local' | 'cloud') {
    if (!window.confirm(choice === 'cloud' ? '이 기록을 Cloud 내용으로 바꿀까요? 이 기기의 해당 기록 변경은 취소됩니다.' : '이 기기의 내용을 Cloud에 보낼까요? 서버에서 다시 변경됐다면 충돌을 다시 확인합니다.')) return;
    setBusy(true); setError('');
    try { await resolve(table, id, choice); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  async function retryItem(operationId: string) {
    if (!window.confirm('실패한 변경과 해당 항목의 대기 변경을 현재 이 기기의 최신 내용으로 대체해 다시 전송할까요? 삭제한 항목이면 삭제 의도를 전송합니다. Cloud 충돌이 있으면 먼저 해결해 주세요.')) return;
    setBusy(true); setError('');
    try { await retryFailed(operationId); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  return <><PageTitle eyebrow="WORKSPACE" title="Cloud 동기화" description="로컬 변경은 먼저 이 기기에 저장하고, 연결되면 같은 계정의 기기들과 주고받습니다." />
    <section className="card"><h2 aria-live="polite">{syncLabel(state)}</h2><p>전송 대기 {state.pending}개 · 충돌 {state.conflict_count}개</p>
      <p>마지막 확인: {state.last_success ? new Date(state.last_success).toLocaleString() : '아직 없음'}</p>
      <p className="muted">앱을 사용하는 동안 저장·온라인 복귀·화면 복귀 시 자동 동기화하며, 다른 기기의 변경도 주기적으로 확인합니다. 앱이 완전히 종료되어 있으면 다음 실행에서 이어갑니다.</p>
      {(state.phase === 'local_only' || state.phase === 'auth_required') && <NavLink to="/account">계정 연결 / Cloud 인증</NavLink>}
      <Button onClick={retry} disabled={state.phase === 'syncing' || busy}>지금 동기화</Button>
      {account?.session_warning && <p className="notice" role="status">{account.session_warning}</p>}
      {state.error && <p className="error" role="alert">{state.error} 로컬 변경은 보관됩니다.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    {state.failed_count > 0 && <p className="notice" role="status">전송 실패 {state.failed_count}개는 이 기기에 보관됩니다. 같은 항목의 후속 변경은 대기하며, 다른 항목과 Cloud 수신은 계속 진행합니다.</p>}
    {state.failures.map(item => <section className="card" key={item.operation_id}>
      <h2>{String(item.local?.title || item.local?.name || item.payload?.title || item.payload?.name || item.entity_table)}</h2>
      <p className="error">{item.last_error}</p><p className="muted">실패 시각: {new Date(item.failed_at).toLocaleString()} · 실패 {item.attempts}회</p>
      <details><summary>전송 실패한 내용</summary><pre className="sync-preview">{item.payload ? JSON.stringify(item.payload, null, 2) : '삭제 요청'}</pre></details>
      <details><summary>현재 이 기기의 최신 내용</summary><pre className="sync-preview">{item.local ? JSON.stringify(item.local, null, 2) : '이 기기에서 삭제됨'}</pre></details>
      <Button disabled={busy || state.phase === 'syncing'} onClick={() => void retryItem(item.operation_id)}>최신 내용으로 재시도</Button>
    </section>)}
    {state.conflicts.map(item => <section className="card" key={`${item.entity_table}/${item.id}`}><h2>{String(item.local?.title || item.local?.name || item.remote.payload?.title || item.remote.payload?.name || item.entity_table)}</h2><p className="muted">같은 기록이 다른 기기에서 변경되어 자동으로 덮어쓰지 않았습니다.</p>
      <details><summary>이 기기 내용</summary><pre className="sync-preview">{item.local ? JSON.stringify(item.local, null, 2) : '이 기기에서 삭제됨'}</pre></details>
      <details><summary>Cloud 내용</summary><pre className="sync-preview">{item.remote.deleted ? 'Cloud에서 삭제됨' : JSON.stringify(item.remote.payload, null, 2)}</pre></details>
      <div className="dialog-actions"><Button disabled={busy || state.phase === 'syncing'} onClick={() => void choose(item.entity_table, item.id, 'local')}>이 기기 내용 유지</Button><Button disabled={busy || state.phase === 'syncing'} onClick={() => void choose(item.entity_table, item.id, 'cloud')}>Cloud 내용 사용</Button></div>
    </section>)}
  </>;
}
