import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { safeAvatarUrl } from '../domain/identity';
import { isAndroid } from '../services/runtime';
import { registerBackHandler } from '../services/native-back';
import { useNativeProfile } from '../app/NativeProfileProvider';
export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return <button type="button" {...props} className={`${variant === 'primary' ? 'primary-button' : variant === 'danger' ? 'danger-button' : ''} ${className}`} />;
}
export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }) { return <Button {...props} className={`icon-button ${props.className ?? ''}`} />; }
export function Avatar({ name, url }: { name: string; url?: string | null }) {
  const local = useNativeProfile()?.source;
  const [failed, setFailed] = useState<string[]>([]); useEffect(() => setFailed([]), [local, url]);
  const remote = url && safeAvatarUrl(url);
  const src = local && !failed.includes(local) ? local : remote && !failed.includes(remote) ? remote : null;
  return <span className="avatar">{src ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(previous => [...previous, src])} /> : name.trim().slice(0, 1).toLocaleUpperCase() || 'T'}</span>;
}
export function Popover({ label, trigger, children }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDialogElement>(null); const button = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); };
  useEffect(() => {
    if (!isAndroid || !open) return;
    return registerBackHandler(75, () => { close(); return true; });
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const element = panel.current;
    // The native modal top layer consumes the dismissing click and makes the
    // underlying drawer/page inert, without racing pointerdown against click.
    element.showModal();
    const position = () => {
      const rect = button.current!.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
      element.style.maxHeight = `${Math.max(48, height - 16)}px`;
      element.style.maxWidth = `${Math.max(48, width - 16)}px`;
      element.style.left = `${Math.max(left + 8, Math.min(rect.right - element.offsetWidth, left + width - element.offsetWidth - 8))}px`;
      element.style.top = `${Math.max(top + 8, Math.min(rect.top - element.offsetHeight - 8, top + height - element.offsetHeight - 8))}px`;
    };
    position(); window.addEventListener('resize', position); window.visualViewport?.addEventListener('resize', position); window.visualViewport?.addEventListener('scroll', position);
    return () => { element.close(); window.removeEventListener('resize', position); window.visualViewport?.removeEventListener('resize', position); window.visualViewport?.removeEventListener('scroll', position); button.current?.focus(); };
  }, [open]);
  return <div className="popover"><button ref={button} type="button" className="icon-button" aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(v => !v)}>{trigger}</button>{open && <dialog ref={panel} className="popover-panel" aria-label={label} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>{children(close)}</dialog>}</div>;
}
