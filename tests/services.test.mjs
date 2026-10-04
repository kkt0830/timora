import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseAuth } from '../src/data/supabase-auth.ts';
import { SupabaseRepository } from '../src/data/supabase-repository.ts';
import { ApiError, apiRequest } from '../src/data/http.ts';

const config = { url: 'https://test.supabase.co', publishableKey: 'sb_publishable_test' };
const user = { id: 'user-a', email: 'a@example.com' };
const tokens = (access_token = 'access', expires_in = 3600) => ({ access_token, refresh_token: 'refresh', expires_in, user });
const response = (body, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status });
function storage() { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; }

test('Auth signs in, persists, restores against the server, and clears storage on offline logout', async () => {
  const store = storage(); const auth = new SupabaseAuth(config, store);
  const calls = [];
  const mock = test.mock.method(globalThis, 'fetch', async (url, init) => { calls.push([url, init]); return response(url.endsWith('/user') ? user : tokens()); });
  try {
    await auth.signIn('a@example.com', 'not-a-real-password');
    assert.equal(await auth.token(), 'access');
    const restored = new SupabaseAuth(config, store);
    assert.deepEqual(await restored.restore(), user);
    assert.equal(calls.some(([url]) => url.endsWith('/user')), true);
    mock.mock.mockImplementation(async () => { throw new Error('offline'); });
    await assert.rejects(auth.signOut());
    assert.equal(await new SupabaseAuth(config, store).restore(), null);
  } finally { mock.mock.restore(); }
});
test('Email confirmation signup does not claim a signed-in session', async () => {
  const auth = new SupabaseAuth(config, storage());
  const mock = test.mock.method(globalThis, 'fetch', async () => response({ user }));
  try { assert.equal(await auth.signUp('a@example.com', 'not-a-real-password'), false); await assert.rejects(auth.token()); } finally { mock.mock.restore(); }
});
test('Concurrent refreshes share one request; rejected refresh expires the session', async () => {
  const auth = new SupabaseAuth(config, storage()); let calls = 0;
  const mock = test.mock.method(globalThis, 'fetch', async () => { calls++; return response(tokens('new', 0)); });
  try {
    await auth.signIn('a@example.com', 'not-a-real-password');
    mock.mock.mockImplementation(async () => { calls++; return response(tokens('rotated')); });
    assert.deepEqual(await Promise.all([auth.token(), auth.token()]), ['rotated', 'rotated']);
    assert.equal(calls, 2);
    mock.mock.mockImplementation(async () => response({ msg: 'Invalid refresh token' }, 400));
    await assert.rejects(auth.token(true)); await assert.rejects(auth.token());
  } finally { mock.mock.restore(); }
});
test('A refresh completing after logout cannot restore the account', async () => {
  const auth = new SupabaseAuth(config, storage());
  const mock = test.mock.method(globalThis, 'fetch', async () => response(tokens('old', 0)));
  let finish; let announce;
  const started = new Promise(resolve => { announce = resolve; });
  try {
    await auth.signIn('a@example.com', 'not-a-real-password');
    mock.mock.mockImplementation(url => url.includes('refresh_token') ? new Promise(resolve => { finish = resolve; announce(); }) : Promise.resolve(response(null, 204)));
    const pending = auth.token(); const rejected = assert.rejects(pending);
    await started; await auth.signOut(); finish(response(tokens('stale')));
    await rejected; assert.equal(await auth.restore(), null);
  } finally { mock.mock.restore(); }
});
test('Transient refresh failure retains credentials for a later retry', async () => {
  const auth = new SupabaseAuth(config, storage());
  const mock = test.mock.method(globalThis, 'fetch', async () => response(tokens('old', 0)));
  try {
    await auth.signIn('a@example.com', 'not-a-real-password');
    mock.mock.mockImplementation(async () => { throw new Error('offline'); });
    await assert.rejects(auth.token());
    mock.mock.mockImplementation(async () => response(tokens('recovered')));
    assert.equal(await auth.token(), 'recovered');
  } finally { mock.mock.restore(); }
});
test('Repository sends owner filters, bearer tokens, full writes and atomic Inbox RPC', async () => {
  const calls = [];
  const repository = new SupabaseRepository(config, { token: async () => 'access' });
  const mock = test.mock.method(globalThis, 'fetch', async (url, init) => { calls.push([url, init]); return response(url.includes('/rpc/') ? 'new-id' : [{ id: 'row' }]); });
  try {
    await repository.save('notes', user.id, { title: 'test', content: '# test', project_id: null }, 'note-id');
    const [url, init] = calls[0];
    assert.match(url, /user_id=eq.user-a/); assert.equal(init.method, 'PATCH');
    assert.equal(init.headers.get('Authorization'), 'Bearer access');
    assert.equal(JSON.parse(init.body).user_id, user.id);
    await repository.convertInbox(user.id, 'inbox-id', 'task');
    assert.match(calls[1][0], /rpc\/convert_inbox$/);
    assert.deepEqual(JSON.parse(calls[1][1].body), { item_id: 'inbox-id', target_kind: 'task' });
  } finally { mock.mock.restore(); }
});
test('RLS zero-row update/delete is surfaced as an error, not success', async () => {
  const repository = new SupabaseRepository(config, { token: async () => 'access' });
  const mock = test.mock.method(globalThis, 'fetch', async () => response([]));
  try {
    await assert.rejects(repository.save('notes', user.id, { title: 'test', content: '', project_id: null }, 'hidden-id'));
    await assert.rejects(repository.remove('notes', user.id, 'hidden-id'));
  } finally { mock.mock.restore(); }
});
test('An expired access token is retried once with a refreshed bearer token', async () => {
  let call = 0; const repository = new SupabaseRepository(config, { token: async force => force ? 'new' : 'old' });
  const mock = test.mock.method(globalThis, 'fetch', async (_url, init) => { call++; return init.headers.get('Authorization') === 'Bearer old' ? response({ message: 'expired' }, 401) : response([{ id: 'n' }]); });
  try { await repository.save('notes', user.id, { title: 'test', content: '', project_id: null }); assert.equal(call, 2); } finally { mock.mock.restore(); }
});
test('Malformed server responses and network errors are actionable', async () => {
  const mock = test.mock.method(globalThis, 'fetch', async () => new Response('bad-json'));
  try {
    await assert.rejects(apiRequest(config, '/test'), ApiError);
    mock.mock.mockImplementation(async () => { throw new Error('offline'); });
    await assert.rejects(apiRequest(config, '/test'), error => error.status === 0);
  } finally { mock.mock.restore(); }
});

test('Workspace load follows pages instead of silently stopping at the API row limit', async () => {
  const repository = new SupabaseRepository(config, { token: async () => 'access' });
  const calls = [];
  const mock = test.mock.method(globalThis, 'fetch', async url => {
    calls.push(url); const parsed = new URL(url);
    if (parsed.pathname.endsWith('/notes')) return response(parsed.searchParams.get('offset') === '0' ? Array.from({ length: 500 }, (_, i) => ({ id: `n-${i}` })) : [{ id: 'n-500' }]);
    return response([]);
  });
  try { const data = await repository.load(user.id); assert.equal(data.notes.length, 501); assert.equal(calls.some(url => url.includes('offset=500')), true); }
  finally { mock.mock.restore(); }
});

test('An obsolete restore cannot clear a newer login when its refresh finishes later', async () => {
  const auth = new SupabaseAuth(config, storage());
  const mock = test.mock.method(globalThis, 'fetch', async () => response(tokens('old', 0)));
  let finish; let announce;
  const started = new Promise(resolve => { announce = resolve; });
  try {
    await auth.signIn('a@example.com', 'not-a-real-password');
    mock.mock.mockImplementation(url => url.includes('grant_type=refresh_token')
      ? new Promise(resolve => { finish = resolve; announce(); })
      : Promise.resolve(response({ ...tokens('new-account'), user: { id: 'user-b', email: 'b@example.com' } })));
    const restoring = auth.restore();
    await started;
    await auth.signIn('b@example.com', 'not-a-real-password');
    finish(response(tokens('old-account-refreshed')));
    assert.equal((await restoring)?.id, 'user-b');
    assert.equal(await auth.token(), 'new-account');
  } finally { mock.mock.restore(); }
});

test('A new login does not share a previous account pending refresh', async () => {
  const auth = new SupabaseAuth(config, storage());
  const mock = test.mock.method(globalThis, 'fetch', async () => response(tokens('old', 0)));
  let finish, started;
  const ready = new Promise(resolve => { started = resolve; });
  try {
    await auth.signIn('a@example.com', 'fixture');
    mock.mock.mockImplementation(url => url.includes('grant_type=refresh_token') ? new Promise(resolve => { finish = resolve; started(); }) : Promise.resolve(response(null, 204)));
    const refresh = auth.token(); const rejected = assert.rejects(refresh);
    await ready; await auth.signOut();
    mock.mock.mockImplementation(async () => response({ ...tokens('account-b'), user: { id: 'user-b' } }));
    await auth.signIn('b@example.com', 'fixture');
    assert.equal(await auth.token(), 'account-b');
    finish(response(tokens('obsolete'))); await rejected;
    assert.equal(await auth.token(), 'account-b');
  } finally { mock.mock.restore(); }
});
test('Signup passes a validated nickname as presentation metadata', async () => {
  let body;
  const auth = new SupabaseAuth(config, storage());
  const mock = test.mock.method(globalThis, 'fetch', async (_url, init) => { body = JSON.parse(init.body); return response({ user }); });
  try {
    await auth.signUp('a@example.com', 'fixture', ' 이름 ');
    assert.equal(body.data.display_name, '이름');
    await assert.rejects(auth.signUp('a@example.com', 'fixture', 'a'.repeat(65)));
  } finally { mock.mock.restore(); }
});

test('A refresh queued behind a Web Lock cannot refresh a newly signed-in account', async () => {
  const auth = new SupabaseAuth(config, storage());
  let release;
  const lock = test.mock.method(navigator.locks, 'request', (_key, _options, run) => new Promise((resolve, reject) => {
    release = () => Promise.resolve().then(run).then(resolve, reject);
  }));
  let refreshCalls = 0;
  const mock = test.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('grant_type=refresh_token')) refreshCalls++;
    return response(tokens('old', 0));
  });
  try {
    await auth.signIn('a@example.com', 'fixture');
    const pending = auth.token(); const rejected = assert.rejects(pending, /세션이 변경/);
    mock.mock.mockImplementation(async () => response({ ...tokens('account-b'), user: { id: 'user-b' } }));
    await auth.signIn('b@example.com', 'fixture');
    await release(); await rejected;
    assert.equal(refreshCalls, 0);
    assert.equal(await auth.token(), 'account-b');
  } finally { lock.mock.restore(); mock.mock.restore(); }
});

test('Profile settings retain owner and reject unsafe URLs before an HTTP write', async () => {
  const repository = new SupabaseRepository(config, { token: async () => 'access' });
  let body, calls = 0;
  const mock = test.mock.method(globalThis, 'fetch', async (_url, init) => {
    calls++; body = JSON.parse(init.body); return response([body]);
  });
  const settings = { user_id: user.id, workspace_name: 'My workspace', appearance: 'dark', display_name: ' 이름 ', avatar_url: 'https://example.com/avatar.png' };
  try {
    const saved = await repository.saveSettings(settings);
    assert.equal(saved.display_name, '이름'); assert.equal(body.user_id, user.id);
    assert.equal(body.avatar_url, settings.avatar_url);
    await assert.rejects(repository.saveSettings({ ...settings, avatar_url: 'javascript:alert(1)' }));
    assert.equal(calls, 1);
    await repository.saveSettings({ ...settings, avatar_url: null });
    assert.equal(body.avatar_url, null);
  } finally { mock.mock.restore(); }
});
