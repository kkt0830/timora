// Browser tests exercise the production UI with an HTTP fixture, never a fake UI.
// Real hosted Supabase email delivery and session configuration are a separate PC check.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.TIMORA_PLAYWRIGHT_MODULE ?? 'playwright');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = ''; server.stdout.on('data', data => { output += data; }); server.stderr.on('data', data => { output += data; });
let browser; let activePage;
await mkdir('test-results', { recursive: true });
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch('http://localhost:4173')).ok) break; } catch {}
    if (attempt > 100) throw new Error(`Vite did not start: ${output}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const tables = ['tasks', 'notes', 'projects', 'events', 'library_items', 'inbox_items'];
  const stores = { a: Object.fromEntries(tables.map(table => [table, []])), b: Object.fromEntries(tables.map(table => [table, []])) };
  const settings = { a: [], b: [] }; let failure = false; let delay = 0;
  const account = id => ({ id, email: `${id}@example.com` });
  const errors = [];
  const page = await context.newPage(); activePage = page; page.on('pageerror', error => errors.push(error.message));
  await context.route('https://test.supabase.co/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    const owner = request.headers().authorization?.endsWith('-b') ? 'b' : 'a';
    const body = request.postDataJSON();
    const fulfill = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: data === null ? '' : JSON.stringify(data) });
    if (url.pathname.includes('/auth/v1/')) {
      if (url.pathname.endsWith('/signup')) return fulfill({ user: account('a') });
      if (url.pathname.endsWith('/logout')) return fulfill(null, 204);
      if (url.pathname.endsWith('/user')) return fulfill(account(owner));
      const id = body.email?.startsWith('b@') ? 'b' : owner;
      return fulfill({ access_token: `access-${id}`, refresh_token: `refresh-${id}`, expires_in: 3600, user: account(id) });
    }
    if (failure && request.method() === 'GET') return fulfill({ message: 'Fixture network error' }, 503);
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (url.pathname.endsWith('/rpc/convert_inbox')) {
      const source = stores[owner].inbox_items.find(item => item.id === body.item_id);
      if (!source) return fulfill({ message: 'Already converted' }, 400);
      const table = body.target_kind === 'task' ? 'tasks' : 'notes';
      stores[owner][table].push({ id: crypto.randomUUID(), user_id: owner, title: source.content, content: source.content, description: source.content, status: 'todo', priority: 'medium', start_date: null, due_date: null, project_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      stores[owner].inbox_items = stores[owner].inbox_items.filter(item => item.id !== source.id);
      return fulfill('new-id');
    }
    const table = url.pathname.split('/').at(-1);
    if (table === 'workspace_settings') {
      if (request.method() === 'POST') settings[owner] = [{ ...body, updated_at: new Date().toISOString() }];
      return fulfill(settings[owner]);
    }
    if (!tables.includes(table)) return fulfill({ message: 'Unexpected endpoint' }, 404);
    const id = url.searchParams.get('id')?.slice(3);
    if (request.method() === 'POST') {
      const row = { ...body, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      stores[owner][table].push(row); return fulfill([row]);
    }
    if (request.method() === 'PATCH') {
      const row = stores[owner][table].find(item => item.id === id); if (!row) return fulfill([]);
      Object.assign(row, body, { updated_at: new Date().toISOString() }); return fulfill([row]);
    }
    if (request.method() === 'DELETE') {
      const row = stores[owner][table].find(item => item.id === id);
      stores[owner][table] = stores[owner][table].filter(item => item.id !== id);
      if (table === 'projects') for (const key of ['tasks', 'notes', 'events', 'library_items']) for (const item of stores[owner][key]) if (item.project_id === id) item.project_id = null;
      return fulfill(row ? [row] : []);
    }
    return fulfill(stores[owner][table]);
  });
  async function visible(locator) { await locator.waitFor({ state: 'visible' }); }
  async function login(id) {
    await page.getByLabel('이메일', { exact: true }).fill(`${id}@example.com`);
    await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await visible(page.getByRole('heading', { name: '오늘도 나의 흐름으로 👋' }));
  }
  async function nav(label) {
    if (label === 'Settings' || label === 'Profile') { await page.getByRole('button', { name: '프로필 메뉴', exact: true }).click(); await page.locator('.popover-panel').getByRole('link', { name: label, exact: true }).click(); return; } await page.locator('.sidebar').getByRole('link', { name: new RegExp(`^${label}(?:\\s*\\d+)?$`) }).click(); }
  async function create(action, title, extra = async () => {}) {
    await page.getByRole('button', { name: action, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').first().fill(title); await extra(dialog);
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  await page.goto('http://localhost:4173'); await login('a');
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true, animations: 'disabled' });
  for (const label of ['Today', 'Tasks', 'Notes', 'Calendar', 'Projects', 'Library', 'Settings']) {
    await nav(label); await visible(page.getByRole('heading', { name: label, exact: true, level: 1 }));
  }
  await nav('Projects'); await create('새 프로젝트', 'Project A');
  await page.getByRole('link', { name: 'Project A', exact: true }).click();
  for (const name of ['Tasks (0)', 'Notes (0)', 'Events (0)', 'Library (0)', 'Overview']) await page.getByRole('button', { name, exact: true }).click();
  await nav('Tasks');
  await create('새 작업', 'Task A', async dialog => {
    await dialog.getByLabel('마감일', { exact: true }).fill(new Date().toLocaleDateString('en-CA'));
    await dialog.getByLabel('프로젝트', { exact: true }).selectOption({ label: 'Project A' });
    await dialog.getByLabel('우선순위', { exact: true }).selectOption('high');
  });
  await page.getByRole('button', { name: 'Task A 완료로 변경' }).click();
  await visible(page.getByRole('button', { name: 'Task A 미완료로 변경' }));
  await page.getByRole('button', { name: 'Task A', exact: true }).click();
  await page.getByRole('dialog').getByLabel('제목', { exact: true }).fill('Task edited');
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByLabel('상태', { exact: true }).selectOption('todo');
  assert.equal(await page.getByRole('button', { name: 'Task edited', exact: true }).count(), 0);
  await page.getByLabel('상태', { exact: true }).selectOption('all');
  await nav('Notes'); await create('새 노트', 'Note A', async dialog => {
    await dialog.getByLabel('프로젝트', { exact: true }).selectOption({ label: 'Project A' });
    await dialog.getByLabel('내용', { exact: true }).fill('# Heading\n**bold**\n<script>alert(1)</script>');
    await dialog.getByRole('button', { name: '미리보기', exact: true }).click();
    await visible(dialog.getByRole('heading', { name: 'Heading', exact: true }));
    assert.equal(await dialog.getByLabel('내용', { exact: true }).isVisible(), false);
  });
  await page.getByRole('button', { name: 'Note A', exact: true }).click();
  const draft = page.getByRole('dialog').locator('textarea[name=content]');
  await draft.fill('unsaved note draft');
  failure = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => [...document.querySelectorAll('[role=alert]')].some(el => el.textContent.includes('Fixture network error')));
  assert.equal(await draft.inputValue(), 'unsaved note draft');
  assert.equal(await page.getByRole('dialog').isVisible(), true);
  failure = false;
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await visible(page.getByRole('heading', { name: 'Notes', exact: true, level: 1 }));
  await nav('Calendar'); await create('새 일정', 'Event A', async dialog => { await dialog.getByLabel('프로젝트', { exact: true }).selectOption({ label: 'Project A' }); });
  await visible(page.getByRole('button', { name: 'Event A', exact: true }));
  await page.getByRole('button', { name: '다음 달', exact: true }).click(); await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await nav('Library'); await create('자료 추가', 'Library A', async dialog => { await dialog.getByLabel('URL', { exact: true }).fill('https://example.com'); await dialog.getByLabel('프로젝트', { exact: true }).selectOption({ label: 'Project A' }); });
  await visible(page.getByRole('link', { name: 'https://example.com ↗' }));
  await nav('Inbox'); await page.getByLabel('빠르게 기록', { exact: true }).fill('Inbox A'); await page.getByRole('button', { name: 'Inbox에 저장' }).click();
  await visible(page.getByRole('button', { name: 'Inbox A', exact: true }));
  await page.getByRole('button', { name: 'Note로', exact: true }).click();
  await visible(page.getByRole('status')); await nav('Notes'); await visible(page.getByRole('button', { name: 'Inbox A', exact: true }));
  await page.reload(); await visible(page.getByRole('button', { name: 'Note A', exact: true }));
  failure = true; await page.reload(); await visible(page.getByRole('alert'));
  failure = false; delay = 500; await page.getByRole('button', { name: '다시 시도' }).click(); await visible(page.getByRole('status')); delay = 0;
  await visible(page.getByRole('heading', { name: 'Notes', exact: true, level: 1 }));
  await nav('Projects'); await page.getByRole('link', { name: 'Project A', exact: true }).click();
  for (const name of ['Tasks (1)', 'Notes (1)', 'Events (1)', 'Library (1)']) await page.getByRole('button', { name, exact: true }).click();
  await nav('Settings'); await page.getByLabel('Workspace 이름', { exact: true }).fill('A workspace');
  await page.getByLabel('Appearance', { exact: true }).selectOption('dark'); await page.getByRole('button', { name: '설정 저장' }).click();
  await visible(page.getByText('설정을 저장했습니다.', { exact: true })); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await nav('Profile'); await page.getByLabel('닉네임', { exact: true }).fill('나의 이름');
  await page.getByRole('button', { name: '프로필 저장', exact: true }).click(); await visible(page.getByText('프로필을 저장했습니다.', { exact: true }));
  await page.reload(); await visible(page.getByRole('heading', { name: '나의 이름', exact: true }));
  await context.route('https://images.example.com/**', route => route.fulfill({ status: 404 }));
  await page.getByLabel('프로필 사진 URL', { exact: true }).fill('https://images.example.com/avatar.png');
  await page.getByRole('button', { name: '프로필 저장', exact: true }).click();
  await visible(page.getByText('프로필을 저장했습니다.', { exact: true }));
  await page.reload(); await visible(page.getByRole('heading', { name: '나의 이름', exact: true }));
  assert.equal(await page.getByLabel('프로필 사진 URL', { exact: true }).inputValue(), 'https://images.example.com/avatar.png');
  await page.waitForFunction(() => !document.querySelector('.profile-summary .avatar img'));
  await page.getByRole('button', { name: '사진 제거', exact: true }).click();
  await page.getByRole('button', { name: '프로필 저장', exact: true }).click();
  await visible(page.getByText('프로필을 저장했습니다.', { exact: true }));
  await page.reload(); await visible(page.getByRole('heading', { name: '나의 이름', exact: true }));
  assert.equal(await page.getByLabel('프로필 사진 URL', { exact: true }).inputValue(), '');
  await page.getByRole('link', { name: 'Workspace 검색', exact: true }).click(); await page.getByRole('searchbox', { name: 'Workspace 검색', exact: true }).fill('bold');
  await page.getByRole('link', { name: /Note A/ }).click(); await visible(page.getByRole('dialog'));
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '프로필 메뉴', exact: true }).focus(); await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: '프로필 메뉴', exact: true }).getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('button', { name: '프로필 메뉴', exact: true }).getAttribute('aria-expanded'), 'false');
  await page.setViewportSize({ width: 834, height: 1112 }); await nav('Tasks');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: '메뉴 열기' }).click();
  await nav('Tasks'); await visible(page.getByRole('heading', { name: 'Tasks', exact: true, level: 1 }));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'test-results/tasks-mobile-dark.png', fullPage: true, animations: 'disabled' });
  for (const name of ['메뉴 열기', '새 작업']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44);
  }
  const searchBox = await page.getByRole('link', { name: 'Workspace 검색', exact: true }).boundingBox();
  assert.ok(searchBox.width >= 44 && searchBox.height >= 44);
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click(); await nav('Calendar');
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const dayBox = await page.locator('.calendar-day').first().boundingBox();
  assert.ok(dayBox.width >= 44 && dayBox.height >= 44);
  await page.screenshot({ path: 'test-results/calendar-mobile-dark.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click(); await nav('Tasks');
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Task edited', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '프로필 메뉴', exact: true }).click(); await page.locator('.popover-panel').getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.goto('http://localhost:4173'); await login('b');
  assert.equal(await page.getByText('Project A', { exact: true }).count(), 0);
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await nav('Notes');
  assert.equal(await page.getByRole('button', { name: 'Note A', exact: true }).count(), 0);
  await page.goto(`http://localhost:4173/notes?object=${stores.a.notes[0].id}`);
  await visible(page.getByRole('heading', { name: 'Notes', exact: true, level: 1 }));
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '프로필 메뉴', exact: true }).click(); await page.locator('.popover-panel').getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('button', { name: '새 계정 만들기', exact: true }).click();
  await page.getByLabel('닉네임', { exact: true }).fill('새 사용자'); await page.getByLabel('이메일', { exact: true }).fill('new@example.com'); await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: '회원가입', exact: true }).click(); await visible(page.getByRole('status'));
  await page.getByRole('button', { name: '기존 계정으로 로그인', exact: true }).click();
  await page.setViewportSize({ width: 1365, height: 900 }); await page.goto('http://localhost:4173'); await login('a');
  for (const [label, title, edited] of [['Notes', 'Note A', 'Note edited'], ['Calendar', 'Event A', 'Event edited'], ['Library', 'Library A', 'Library edited']]) {
    await nav(label); await page.getByRole('button', { name: title, exact: true }).click();
    await page.getByRole('dialog').getByLabel('제목', { exact: true }).fill(edited);
    await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: edited, exact: true }).click(); page.once('dialog', dialog => dialog.accept());
    await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  await nav('Projects'); await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByRole('dialog').getByLabel('프로젝트 이름', { exact: true }).fill('Project edited'); await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' }); await page.getByRole('link', { name: 'Project edited', exact: true }).click();
  await page.getByRole('button', { name: '프로젝트 수정 / 삭제', exact: true }).click(); page.once('dialog', dialog => dialog.accept());
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await visible(page.getByRole('link', { name: '프로젝트 목록으로', exact: true }));
  await page.getByRole('link', { name: 'Workspace 검색', exact: true }).click(); await page.getByRole('searchbox', { name: 'Workspace 검색', exact: true }).fill('no-such-object');
  await visible(page.getByText('일치하는 기록이 없습니다.', { exact: true }));
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: navigation, CRUD, auth persistence/logout, simulated account switching, dates, errors/loading, Markdown, project detail, settings and mobile layout.');
} catch (error) { if (activePage) await activePage.screenshot({ path: 'test-results/failure.png', fullPage: true, animations: 'disabled' }).catch(() => {}); throw error; } finally { await browser?.close(); server.kill('SIGTERM'); }
