import { useState } from 'react';
import { desktopInvoke } from '../data/local-repository';
import { PageTitle } from './components';
import { messageOf } from './providers';
interface Preview { app_version: string; created_at: string; database_schema_version: number; records: Record<string,number>; pending_changes: number; conflicts: number; has_profile_image: boolean }
export function BackupPage() {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const [preview,setPreview]=useState<Preview|null>(null);
  async function run(command:string){setBusy(true);setError('');setNotice('');try {const result=await desktopInvoke<Preview|null>(command);setPreview(result);setNotice(result?(command==='local_export_backup'?'선택한 위치에 백업을 저장했습니다.':'백업 무결성 검사가 완료되었습니다. 현재 Workspace는 변경하지 않았습니다.'):'파일 선택을 취소했습니다.');}catch(e){setError(messageOf(e));}finally{setBusy(false);}}
  return <><PageTitle title="Backup" eyebrow="YOUR DATA" description="기기의 기록·동기화 대기·충돌·프로필 사진을 ZIP으로 보관합니다."/><div className="card"><p>백업은 암호화되지 않습니다. 파일을 안전한 위치에 보관하세요.</p><button disabled={busy} onClick={()=>void run('local_export_backup')}>백업 내보내기</button><button disabled={busy} onClick={()=>void run('local_inspect_backup')}>백업 파일 검사</button>{busy&&<p role="status">백업 처리 중…</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}{preview&&<dl><dt>앱 버전 / DB 버전</dt><dd>{preview.app_version} / {preview.database_schema_version}</dd><dt>생성 시각</dt><dd>{new Date(preview.created_at).toLocaleString()}</dd>{Object.entries(preview.records).map(([table,count])=><div key={table}><dt>{table}</dt><dd>{count}개</dd></div>)}<dt>전송 대기 / 충돌</dt><dd>{preview.pending_changes} / {preview.conflicts}</dd><dt>프로필 사진</dt><dd>{preview.has_profile_image?'포함':'없음'}</dd></dl>}<p>실제 복원 기능은 아직 제공되지 않습니다. 파일 검사만으로 복원이 완료되는 것은 아닙니다.</p></div></>;
}
