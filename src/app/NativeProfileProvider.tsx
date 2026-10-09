import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Account } from '../services/contracts';
import { desktopInvoke } from '../data/local-repository';

interface NativeProfile { source: string | null; error: string; pending: boolean; pick: () => Promise<void>; remove: () => Promise<void> }
const Context = createContext<NativeProfile | null>(null);
export function useNativeProfile() { return useContext(Context); }
export function NativeProfileProvider({ account, children }: { account: Account; children: ReactNode }) {
  const [source, setSource] = useState<string | null>(null), [error, setError] = useState(''), [pending, setPending] = useState(false);
  const revision = useRef(0), locked = useRef(false);
  useEffect(() => {
    if (!account.local) return;
    let active = true;
    const version = revision.current;
    void desktopInvoke<string | null>('local_avatar').then(value => { if (active && version === revision.current) setSource(value); }).catch(e => { if (active && version === revision.current) setError(e instanceof Error ? e.message : '로컬 사진을 읽을 수 없습니다.'); });
    return () => { active = false; };
  }, [account.id, account.local]);
  if (!account.local) return children;
  const action = async (remove: boolean) => {
    if (locked.current) return;
    locked.current = true; revision.current++;
    setPending(true); setError('');
    try { if (remove) { await desktopInvoke('local_remove_avatar'); setSource(null); } else setSource(await desktopInvoke<string | null>('local_pick_avatar')); }
    catch (e) { setError(e instanceof Error ? e.message : '사진 변경에 실패했습니다.'); throw e; }
    finally { locked.current = false; setPending(false); }
  };
  return <Context.Provider value={{ source, error, pending, pick: () => action(false), remove: () => action(true) }}>{children}</Context.Provider>;
}
