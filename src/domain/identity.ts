export function displayName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 64) throw new Error('닉네임은 1~64자로 입력해 주세요.');
  return name;
}
export function safeAvatarUrl(value: string): string | null {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && value.length <= 2048 && url.href.length <= 2048 ? url.href : null; } catch { return null; }
}
