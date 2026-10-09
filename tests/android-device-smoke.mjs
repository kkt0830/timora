// Real Android emulator/native IPC/SQLite check; physical device/IME acceptance is separate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.TIMORA_PLAYWRIGHT_MODULE ?? 'playwright');
const appId = 'app.timora.android';
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30_000 }).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function attach() {
  adb('shell', 'am', 'start', '-n', `${appId}/.MainActivity`);
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const pid = adb('shell', 'pidof', appId).split(' ')[0];
      adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);
      const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 1500 });
      const page = browser.contexts()[0]?.pages()[0];
      if (page) { await page.waitForFunction(() => typeof window.__TIMORA_BACK__ === 'function'); return { browser, page }; }
      await browser.close();
    } catch {}
    await delay(250);
  }
  throw new Error('Android WebView did not start; inspect emulator crash logs without personal data.');
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
    const settings = (await call('local_load')).settings;
    await call('local_settings', { input: { ...settings, workspace_name: 'Android offline fixture' } });
    return { account, info, taskId: task.id, projectId: project.id };
  });
  assert.equal(result.account.local, true);
  assert.match(result.info.path, /^\/data\/(user\/\d+|data)\/app\.timora\.android\//);
  await session.browser.close(); session = undefined;
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
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  adb('shell', 'input', 'keyevent', '4');
  await page.getByRole('heading', { name: '오늘도 나의 흐름으로 👋' }).waitFor();
  assert.equal(await page.evaluate(() => window.__TIMORA_BACK__()), false);
  assert.equal(adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'), '1');
  await mkdir('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/android-emulator-offline.png', fullPage: true });
  console.log('Android emulator: six entities/settings and identity persisted through force-stop offline; real HashRouter/Back passed. Physical device/IME remains PENDING.');
} finally {
  await session?.browser.close(); adb('forward', '--remove', 'tcp:9222');
}
