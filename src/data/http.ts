export interface BackendConfig { url: string; publishableKey: string }
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function apiRequest<T>(config: BackendConfig, path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('apikey', config.publishableKey);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  let response: Response;
  const timeout = AbortSignal.timeout(15000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try { response = await fetch(`${config.url}${path}`, { ...init, headers, signal }); }
  catch { throw new ApiError('서버에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도해 주세요.', 0); }
  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { throw new ApiError('서버 응답을 읽을 수 없습니다.', response.status); }
  if (!response.ok) {
    const detail = data as { msg?: string; message?: string; error_description?: string } | null;
    throw new ApiError(detail?.msg ?? detail?.message ?? detail?.error_description ?? `요청 실패 (${response.status})`, response.status);
  }
  return data as T;
}
