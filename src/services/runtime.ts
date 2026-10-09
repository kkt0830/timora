export type RuntimePlatform = 'web' | 'windows' | 'android' | 'native';
export function detectRuntime(native: boolean, userAgent: string): RuntimePlatform {
  if (!native) return 'web';
  if (/Android/i.test(userAgent)) return 'android';
  if (/Windows/i.test(userAgent)) return 'windows';
  return 'native';
}
export const platform = detectRuntime(
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  typeof navigator === 'undefined' ? '' : navigator.userAgent,
);
export const isNative = platform !== 'web';
export const isAndroid = platform === 'android';
export const runtimeLabel = platform === 'android' ? 'Android' : platform === 'windows' ? 'Windows' : isNative ? 'Native' : 'Web';

// HTTP(S) only, shared by Library and Markdown. Native imports stay behind this boundary.
export async function openExternalUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('지원하지 않는 URL입니다.');
  if (!isNative) throw new Error('Web에서는 일반 링크를 사용하세요.');
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(parsed.href);
}
