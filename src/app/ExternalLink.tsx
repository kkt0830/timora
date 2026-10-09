import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { isDesktop } from '../services/backend';
import { safeUrl } from '../domain/validation';

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const [error, setError] = useState('');
  const url = safeUrl(href);
  if (!url) return <span>{children}</span>;
  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (!isDesktop) return;
    event.preventDefault(); setError('');
    try { const { openUrl } = await import('@tauri-apps/plugin-opener'); await openUrl(url!); }
    catch { setError('브라우저를 열지 못했습니다. URL을 복사해 열어 주세요.'); }
  }
  return <><a className={className} href={url} target="_blank" rel="noopener noreferrer" onClick={event => void open(event)}>{children}</a>{error && <span role="alert" className="error">{error}</span>}</>;
}
