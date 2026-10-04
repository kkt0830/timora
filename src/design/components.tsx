import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { safeAvatarUrl } from '../domain/identity';
export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return <button type="button" {...props} className={`${variant === 'primary' ? 'primary-button' : variant === 'danger' ? 'danger-button' : ''} ${className}`} />;
}
export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }) { return <Button {...props} className={`icon-button ${props.className ?? ''}`} />; }
export function Avatar({ name, url }: { name: string; url?: string | null }) {
  const [failed, setFailed] = useState(false); useEffect(() => setFailed(false), [url]);
  const src = url && safeAvatarUrl(url);
  return <span className="avatar">{src && !failed ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : name.trim().slice(0, 1).toLocaleUpperCase() || 'T'}</span>;
}
export function Popover({ label, trigger, children }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false); const root = useRef<HTMLDivElement>(null); const button = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); button.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('.popover-panel a, .popover-panel button')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside); root.current?.addEventListener('keydown', escape);
    const element = root.current;
    return () => { document.removeEventListener('pointerdown', outside); element?.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="popover" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}><button ref={button} type="button" className="icon-button" aria-label={label} aria-expanded={open} onClick={() => setOpen(v => !v)}>{trigger}</button>{open && <div className="popover-panel" aria-label={label}>{children(close)}</div>}</div>;
}
