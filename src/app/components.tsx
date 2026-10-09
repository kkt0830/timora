import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowRight, Plus, X } from 'lucide-react';
import { Button, IconButton } from '../design/components';
import { safeUrl } from '../domain/validation';
import { ExternalLink } from './ExternalLink';

export function PageTitle({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <Button variant="primary" onClick={onAction}><Plus size={17} /><span>{action}</span></Button>}</div>;
}
export function SectionTitle({ title, to, count }: { title: string; to?: string; count?: number }) {
  return <div className="section-title"><div className="section-heading"><h2>{title}</h2>{count !== undefined && <span className="count-badge">{count}</span>}</div>{to && <NavLink to={to} className="text-link">전체 보기 <ArrowRight size={15} /></NavLink>}</div>;
}
export function Empty({ children = '아직 항목이 없습니다. 새 항목을 추가해 보세요.' }: { children?: ReactNode }) { return <p className="empty-state">{children}</p>; }
export function Dialog({ title, children, onClose, busy }: { title: string; children: ReactNode; onClose: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    const dialog = ref.current!; dialog.showModal();
    return () => { dialog.close(); opener.current?.focus(); };
  }, []);
  return <dialog ref={ref} className="editor-dialog" aria-labelledby="editor-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><div className="dialog-heading"><h2 id="editor-title">{title}</h2><IconButton disabled={busy} onClick={onClose} aria-label="닫기"><X size={20} /></IconButton></div>{children}</dialog>;
}
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && safeUrl(link[2])) return <ExternalLink key={index} href={link[2]}>{link[1]}</ExternalLink>;
    return part;
  });
}
// Safe Markdown subset; raw HTML is always displayed as text.
export function Markdown({ content }: { content: string }) {
  const blocks: ReactNode[] = []; let code: string[] | null = null;
  for (const [index, line] of content.split('\n').entries()) {
    if (line.startsWith('```')) {
      if (code) { blocks.push(<pre key={index}><code>{code.join('\n')}</code></pre>); code = null; } else code = [];
    } else if (code) code.push(line);
    else if (line.startsWith('### ')) blocks.push(<h4 key={index}>{inline(line.slice(4))}</h4>);
    else if (line.startsWith('## ')) blocks.push(<h3 key={index}>{inline(line.slice(3))}</h3>);
    else if (line.startsWith('# ')) blocks.push(<h2 key={index}>{inline(line.slice(2))}</h2>);
    else if (/^[-*] /.test(line)) blocks.push(<ul key={index}><li>{inline(line.slice(2))}</li></ul>);
    else if (line.startsWith('> ')) blocks.push(<blockquote key={index}>{inline(line.slice(2))}</blockquote>);
    else blocks.push(<p key={index}>{line ? inline(line) : <br />}</p>);
  }
  if (code) blocks.push(<pre key="open-code"><code>{code.join('\n')}</code></pre>);
  return <div className="markdown">{blocks}</div>;
}
