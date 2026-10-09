import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalAuth, LocalWorkspaceRepository } from '../src/data/local-repository.ts';
import { CloudImportService } from '../src/services/cloud-import.ts';
const config = { url: 'https://test.supabase.co', publishableKey: 'sb_publishable_fixture' };
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.com' };
const response = (body, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status });

test('Local Auth/Repository invoke native operations without HTTP or Cloud credentials', async () => {
  const calls = [];
  const invoke = async (command, args) => { calls.push({ command, args }); return command === 'local_account' ? { id: 'local', local: true } : {}; };
  const mock = test.mock.method(globalThis, 'fetch', async () => { throw new Error('No network allowed'); });
  try {
    const auth = new LocalAuth(invoke); const repo = new LocalWorkspaceRepository(invoke);
    assert.deepEqual(await auth.restore(), { id: 'local', local: true });
    await repo.load('local');
    await repo.save('notes', 'local', { title: '노트', content: '# 내용', project_id: null });
    await repo.save('notes', 'local', { title: '수정', content: '# 내용', project_id: null }, 'id');
    await repo.remove('notes', 'local', 'id'); await repo.convertInbox('local', 'inbox', 'task');
    await repo.saveSettings({ workspace_name: '내 공간', appearance: 'dark', display_name: '이름', avatar_url: null });
    await auth.signOut(); await assert.rejects(auth.token());
    assert.equal(mock.mock.callCount(), 0);
    assert.equal(calls[2].args.id, null); assert.equal(calls[3].args.id, 'id');
    assert.deepEqual(calls.map(row => row.command), ['local_account', 'local_load', 'local_save', 'local_save', 'local_remove', 'local_convert', 'local_settings']);
    const failing = new LocalWorkspaceRepository(async () => { throw new Error('Local DB failure'); });
    await assert.rejects(failing.load('local'), /Local DB failure/);
  } finally { mock.mock.restore(); }
});

test('Cloud preview reads owner-filtered data and logs out; it never writes entity/settings data', async () => {
  const calls = [];
  const mock = test.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers });
    if (url.includes('/token?')) return response({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', expires_in: 3600, user });
    if (url.endsWith('/user')) return response(user);
    if (url.includes('/logout')) return response(null, 204);
    return response([]);
  });
  try {
    const service = new CloudImportService(config); const result = await service.preview(user.email, 'fixture-only');
    assert.equal(result.userId, user.id); assert.equal(result.data.settings.user_id, user.id);
    assert.ok(result.data.settings.updated_at);
    const rest = calls.filter(row => row.url.includes('/rest/v1/'));
    assert.equal(rest.length, 7);
    assert.ok(rest.every(row => row.method === 'GET' && row.url.includes(`user_id=eq.${user.id}`)));
    assert.ok(calls.some(row => row.url.includes('/logout')));
  } finally { mock.mock.restore(); }
});

test('Cloud preview failure still clears its session, and rejects privileged/insecure configuration', async () => {
  const calls = [];
  const mock = test.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(url);
    if (url.includes('/token?')) return response({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', expires_in: 3600, user });
    if (url.endsWith('/user')) return response(user);
    if (url.includes('/logout')) return response(null, 204);
    return response({ message: 'fixture unavailable' }, 503);
  });
  try {
    await assert.rejects(new CloudImportService(config).preview(user.email, 'fixture-only'));
    assert.ok(calls.some(url => url.includes('/logout')));
    assert.throws(() => new CloudImportService({ ...config, publishableKey: 'sb_secret_fixture' }));
    assert.throws(() => new CloudImportService({ ...config, url: 'http://test.supabase.co' }));
  } finally { mock.mock.restore(); }
});
