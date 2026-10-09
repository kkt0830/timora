// UI contract only: injected IPC fixture, NOT a native Windows/persistence test.
// Real SQLite transactions are tested in Rust; installed app acceptance is manual.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { emptyWorkspace } from '../src/domain/models.ts';
const { chromium } = await import(process.env.TIMORA_PLAYWRIGHT_MODULE ?? 'playwright');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = ''; server.stdout.on('data', data => { output += data; }); server.stderr.on('data', data => { output += data; });
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch('http://127.0.0.1:4175')).ok) break; } catch {}
    if (attempt > 100) throw new Error(`Vite did not start: ${output}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.TIMORA_CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const config = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
  const devCsp = config.app.security.devCsp.replaceAll('localhost:5173', '127.0.0.1:4175');
  const owner = '11111111-1111-4111-8111-111111111111';
  const data = emptyWorkspace(owner); data.settings.updated_at = new Date().toISOString();
  let openFailure = true, saveFailure = true; const commands = [], externalRequests = [], errors = [];
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') {
      if (route.request().resourceType() === 'document') {
        const response = await route.fetch();
        return route.fulfill({ response, headers: { ...response.headers(), 'Content-Security-Policy': devCsp } });
      }
      return route.continue();
    }
    externalRequests.push(route.request().url()); return route.abort();
  });
  await context.exposeBinding('fixtureInvoke', async (_source, command, args) => {
    commands.push(command);
    if (command === 'local_account') { if (openFailure) throw new Error('Local migration 실패 (fixture)'); return { id: owner, local: true }; }
    if (command === 'local_load') return data;
    if (command === 'local_info') return { id: owner, cloud_user_id: null, imported_at: null, path: 'fixture/timora.db' };
    if (command === 'local_save') {
      if (saveFailure) throw new Error('Local DB 저장 실패 (fixture)');
      const row = { ...args.input, id: crypto.randomUUID(), user_id: owner, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      data[args.table].push(row); return row;
    }
    throw new Error(`Unexpected IPC ${command}`);
  });
  await context.addInitScript(() => { window.__TAURI_INTERNALS__ = { invoke: (command, args) => window.fixtureInvoke(command, args).catch(error => Promise.reject(error.message)) }; });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4175/#/tasks');
  await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /migration 실패/);
  assert.equal(await page.getByLabel('이메일', { exact: true }).count(), 0);
  openFailure = false; await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await page.getByRole('heading', { name: 'Tasks', exact: true, level: 1 }).waitFor();
  await page.getByRole('button', { name: '새 작업', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('제목', { exact: true }).fill('로컬 작업');
  await dialog.getByRole('button', { name: '오늘', exact: true }).click();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await dialog.getByRole('alert').waitFor(); assert.equal(await dialog.getByLabel('제목', { exact: true }).inputValue(), '로컬 작업');
  assert.equal(data.tasks.length, 0);
  saveFailure = false; await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' }); await page.getByRole('button', { name: '로컬 작업', exact: true }).waitFor();
  await page.reload(); await page.getByRole('button', { name: '로컬 작업', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Workspace 검색', exact: true }).click();
  const search = page.getByRole('searchbox'); await search.fill('로컬');
  await page.getByRole('link', { name: /로컬 작업/ }).waitFor(); assert.match(new URL(page.url()).hash, /^#\/search\?q=/);
  await page.reload(); await search.waitFor(); assert.equal(await search.inputValue(), '로컬');
  await page.getByRole('button', { name: '프로필 메뉴', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '로그아웃', exact: true }).count(), 0);
  await page.getByRole('link', { name: 'Cloud 가져오기', exact: true }).click();
  await page.getByText('fixture/timora.db', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Supabase URL', { exact: true }).inputValue(), '');
  assert.equal(await page.getByRole('button', { name: '로그인 후 미리보기', exact: true }).isDisabled(), true);
  await page.getByText('로컬 기록이 있어 가져오기를 사용할 수 없습니다. 기록은 그대로 보관됩니다.', { exact: true }).waitFor();
  assert.deepEqual(externalRequests, []); assert.deepEqual(errors, []);
  assert.ok(commands.includes('local_account') && commands.includes('local_load') && commands.includes('local_save'));
  await mkdir('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/desktop-import-empty-config.png', fullPage: true });
  console.log('Desktop UI fixture passed: empty Cloud config, blocked external network, DB error retry, failed-save draft, local adapter, hash route/reload/search, import entry. Native Windows acceptance remains manual.');
} finally {
  await browser?.close();
  if (server.exitCode === null) { const stopped = new Promise(resolve => server.once('exit', resolve)); server.kill('SIGTERM'); await stopped; }
}
