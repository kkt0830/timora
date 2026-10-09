type BackHandler = { priority: number; handle: () => boolean };
const handlers: BackHandler[] = [];
// Dialog > popover > drawer > route. False hands root behavior back to Android.
export function registerBackHandler(priority: number, handle: () => boolean): () => void {
  const entry = { priority, handle }; handlers.push(entry);
  return () => { const index = handlers.indexOf(entry); if (index >= 0) handlers.splice(index, 1); };
}
export function dispatchNativeBack(): boolean {
  for (const entry of [...handlers].sort((a, b) => b.priority - a.priority)) {
    if (entry.handle()) return true;
  }
  return false;
}
export function installNativeBack(target: Window): () => void {
  const bridge = target as Window & { __TIMORA_BACK__?: () => boolean };
  bridge.__TIMORA_BACK__ = dispatchNativeBack;
  return () => { delete bridge.__TIMORA_BACK__; };
}
