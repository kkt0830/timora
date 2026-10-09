// Real Android emulator/native IPC/SQLite check; physical device/IME acceptance is separate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const { _android } = await import(process.env.TIMORA_PLAYWRIGHT_MODULE ?? 'playwright');
const appId = 'app.timora.android';
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30_000 }).trim();
async function attach() {
  adb('shell', 'am', 'start', '-n', `${appId}/.MainActivity`);
  let device;
  try {
    [device] = await _android.devices();
    assert.ok(device, 'Dedicated Android emulator must be available');
    // Desktop connectOverCDP sends Browser.setDownloadBehavior, which WebView
    // does not support. The Android transport handles WebView's protocol subset.
    const webview = await device.webView({ pkg: appId }, { timeout: 60_000 });
    const page = await webview.page();
    await page.waitForFunction(() => typeof window.__TIMORA_BACK__ === 'function', null, { timeout: 30_000 });
    return { device, page };
  } catch (error) {
    await device?.close().catch(() => {});
    // Dedicated fresh CI emulator only: no user credentials/workspace in crash diagnostics.
    console.error(adb('logcat', '-d', '-b', 'crash'));
    throw error;
  }
}
const apk = process.env.TIMORA_TEST_APK;
assert.ok(apk, 'TIMORA_TEST_APK must reference the installable x86_64 test APK');
adb('install', '-r', apk);
adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
adb('shell', 'svc', 'wifi', 'disable'); adb('shell', 'svc', 'data', 'disable');
assert.equal(adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'), '1');
let session;
try {
  session = await attach(); let { page } = session;
  const result = await page.evaluate(async () => {
    const call = (command, args) => window.__TAURI_INTERNALS__.invoke(command, args);
    const account = await call('local_account'); const info = await call('local_info');
    const project = await call('local_save', { table: 'projects', id: null, input: { name: 'Android smoke project', description: 'fixture', status: 'active', color: '#0066cc' } });
    const task = await call('local_save', { table: 'tasks', id: null, input: { title: 'Android offline task', description: 'fixture', status: 'done', priority: 'high', start_date: '2026-10-09', due_date: '2026-10-10', project_id: project.id } });
    await call('local_save', { table: 'notes', id: null, input: { title: 'Android note', content: '# 안녕하세요\n**offline**', project_id: project.id } });
    await call('local_save', { table: 'events', id: null, input: { title: 'Android event', description: 'fixture', start_at: '2026-10-09T09:00:00+09:00', end_at: '2026-10-09T10:00:00+09:00', project_id: project.id } });
    await call('local_save', { table: 'library_items', id: null, input: { title: 'Android resource', description: 'fixture', url: 'https://example.com', type: 'website', project_id: project.id } });
    await call('local_save', { table: 'inbox_items', id: null, input: { content: 'Android inbox', type: 'unclassified' } });
    const snapshot = await call('local_load');
    // Exercise all CRUD commands in the actual Android binary, not an IPC fixture.
    for (const table of ['projects', 'tasks', 'notes', 'events', 'library_items', 'inbox_items']) {
      const row = snapshot[table][0];
      const field = table === 'projects' ? 'name' : table === 'inbox_items' ? 'content' : 'title';
      const input = { ...row, [field]: `${row[field]} edited` };
      const updated = await call('local_save', { table, id: row.id, input });
      if (updated.id !== row.id || updated[field] !== input[field]) throw new Error(`${table}: update failed`);
      const disposable = await call('local_save', { table, id: null, input });
      await call('local_remove', { table, id: disposable.id });
      const remaining = (await call('local_load'))[table];
      if (remaining.length !== 1 || remaining[0].id !== row.id) throw new Error(`${table}: delete/read failed`);
    }
    const settings = snapshot.settings;
    await call('local_settings', { input: { ...settings, workspace_name: 'Android offline fixture' } });
    return { account, info, taskId: task.id, projectId: project.id };
  });
  assert.equal(result.account.local, true);
  assert.match(result.info.path, /^\/data\/(user\/\d+|data)\/app\.timora\.android\//);
  await session.device.close(); session = undefined;
  // force-stop kills the process, not just the Activity/WebView.
  adb('shell', 'am', 'force-stop', appId);
  assert.throws(() => adb('shell', 'pidof', appId));
  session = await attach(); page = session.page;
  const restored = await page.evaluate(async () => ({
    account: await window.__TAURI_INTERNALS__.invoke('local_account'),
    data: await window.__TAURI_INTERNALS__.invoke('local_load'),
  }));
  assert.equal(restored.account.id, result.account.id);
  for (const table of ['projects', 'tasks', 'notes', 'events', 'library_items', 'inbox_items']) assert.equal(restored.data[table].length, 1, table);
  assert.equal(restored.data.tasks[0].id, result.taskId); assert.equal(restored.data.tasks[0].project_id, result.projectId);
  assert.equal(restored.data.tasks[0].status, 'done'); assert.equal(restored.data.tasks[0].due_date, '2026-10-10');
  assert.equal(restored.data.notes[0].content, '# 안녕하세요\n**offline**');
  assert.equal(restored.data.settings.workspace_name, 'Android offline fixture');
  await page.reload(); await page.getByRole('heading', { name: '오늘도 나의 흐름으로 👋' }).waitFor();
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await page.getByRole('heading', { name: 'Tasks', exact: true, level: 1 }).waitFor();
  await page.getByRole('button', { name: '새 작업', exact: true }).click();
  adb('shell', 'input', 'keyevent', '4');
  // Android may first consume Back to dismiss the IME before dispatching app navigation.
  try { await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 2000 }); }
  catch { adb('shell', 'input', 'keyevent', '4'); }
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  adb('shell', 'input', 'keyevent', '4');
  await page.getByRole('heading', { name: '오늘도 나의 흐름으로 👋' }).waitFor();
  assert.equal(await page.evaluate(() => window.__TIMORA_BACK__()), false);
  assert.equal(adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'), '1');
  await mkdir('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/android-emulator-offline.png', fullPage: true });
  console.log('Android emulator: six-entity CRUD/settings and identity persisted through force-stop offline; real HashRouter/Back passed. Physical device/IME remains PENDING.');
} finally {
  await session?.device.close();
}
