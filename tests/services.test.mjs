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
