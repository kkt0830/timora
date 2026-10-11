// Shared React/native IPC contract fixture; not a real Supabase login or OS picker test.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { emptyWorkspace } from '../src/domain/models.ts';
import { mkdir } from 'node:fs/promises';
const {chromium}=await import(process.env.TIMORA_PLAYWRIGHT_MODULE??'playwright');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4176','--strictPort'],{env:{...process.env,VITE_SUPABASE_URL:'https://native-fixture.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);let browser;
const owner='11111111-1111-4111-8111-111111111111',cloud='22222222-2222-4222-8222-222222222222';
const data=emptyWorkspace(owner);let state='new',photo=null,pickFailure=false,tokenEmail='',syncConflicts=[];const requests=[],errors=[];
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=';
try{
 for(let i=0;;i++){try{if((await fetch('http://127.0.0.1:4176')).ok)break;}catch{}if(i>100)throw new Error(output);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.TIMORA_CHROMIUM_PATH||undefined});
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'});
 await context.route('**/*',async route=>{
  const url=route.request().url();if(url.startsWith('http://127.0.0.1:4176'))return route.fulfill({response:await route.fetch()});requests.push(url);
  if(url.includes('/auth/v1/token?grant_type=password')){tokenEmail=route.request().postDataJSON().email;return route.fulfill({json:{access_token:`fixture-${tokenEmail}`,refresh_token:'fixture-refresh',expires_in:3600,user:{id:cloud,email:tokenEmail}}});}
  if(url.includes('/auth/v1/logout'))return route.fulfill({status:204});
  if(url.includes('/auth/v1/signup'))return route.fulfill({json:{user:{id:cloud}}});
  return route.abort();
 });
 await context.exposeBinding('fixtureInvoke',async(_source,command,args)=>{
  if(command==='local_account')return ['new','signed_out'].includes(state)?null:{id:owner,local:true,local_only:false,cloud_user_id:cloud,email:'a@example.com'};
  if(command==='local_bind_account'){if(tokenEmail!=='a@example.com')throw new Error('이 Workspace는 다른 계정에 연결되어 있습니다. 원래 계정으로 로그인해 주세요.');state='signed_in';return {id:owner,local:true,local_only:false,cloud_user_id:cloud,email:tokenEmail};}
  if(command==='local_sign_out'){state='signed_out';return null;}
  if(state!=='signed_in')throw new Error('Workspace locked');
  if(command==='local_session_read')return null;
  if(command==='local_session_write')return null;
  if(command==='local_sync_status')return {pending:syncConflicts.length,conflict_count:syncConflicts.length,conflicts:syncConflicts,cursor:'0',last_success:null};
  if(command==='local_sync_next')return null;
  if(command==='local_sync_resolve'){assert.equal(args.cloudUserId,cloud);assert.equal(args.choice,'cloud');data.tasks[0]={...data.tasks[0],title:'Cloud task'};syncConflicts=[];return null;}
  if(command==='local_load')return data;
  if(command==='local_avatar')return photo;
  if(command==='local_pick_avatar'){if(pickFailure)throw new Error('손상된 사진입니다. 기존 사진은 보존됩니다.');photo=image;return photo;}
  if(command==='local_remove_avatar'){photo=null;return null;}
  if(command==='local_settings'){data.settings={...args.input,updated_at:new Date().toISOString()};return data.settings;}
  if(command==='local_save'){const row={...args.input,id:crypto.randomUUID(),user_id:owner,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};data[args.table].push(row);return row;}
  throw new Error(`Unexpected IPC ${command}`);
 });
 await context.addInitScript(()=>{window.__TAURI_INTERNALS__={invoke:(c,a)=>window.fixtureInvoke(c,a).catch(e=>Promise.reject(e.message))};});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:4176/#/');await page.getByRole('button',{name:'로그인',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'오늘도 나의 흐름으로 👋'}).count(),0);
 await page.getByRole('button',{name:'새 계정 만들기'}).click();await page.getByLabel('닉네임',{exact:true}).fill('가입 이름');await page.getByLabel('이메일',{exact:true}).fill('a@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'회원가입',exact:true}).click();await page.getByText(/이메일의 확인 링크/).waitFor();assert.equal(state,'new');
 await page.getByRole('button',{name:'기존 계정으로 로그인'}).click();await page.getByLabel('이메일',{exact:true}).fill('a@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('heading',{name:'오늘도 나의 흐름으로 👋'}).waitFor();
 await page.goto('http://127.0.0.1:4176/#/tasks');await page.getByRole('button',{name:'새 작업',exact:true}).click();await page.getByRole('dialog').getByLabel('제목',{exact:true}).fill('A의 기록');await page.getByRole('dialog').getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.goto('http://127.0.0.1:4176/#/profile');await page.getByRole('button',{name:'사진 선택',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.profile-summary img')?.src.startsWith('data:image/png;base64,'));
 await page.getByLabel('닉네임',{exact:true}).fill('로컬 이름');await page.getByRole('button',{name:'프로필 저장',exact:true}).click();await page.getByText('프로필을 저장했습니다.',{exact:true}).waitFor();
 pickFailure=true;await page.getByRole('button',{name:'사진 선택',exact:true}).click();await page.getByRole('alert').getByText(/손상된 사진/).waitFor();assert.equal(await page.locator('.profile-summary img').getAttribute('src'),image);
 await context.setOffline(true);await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));const before=requests.length;await page.reload();await page.getByRole('heading',{name:'로컬 이름',exact:true}).waitFor();await page.getByText('오프라인 · 로컬 저장 가능',{exact:true}).waitFor();assert.equal(await page.locator('.profile-summary img').getAttribute('src'),image);assert.equal(requests.length,before);
 await context.setOffline(false);await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>true,configurable:true}));await page.reload();await page.getByText('Cloud 재인증 필요 · 로컬 저장 가능',{exact:true}).waitFor();
 await page.goto('http://127.0.0.1:4176/#/settings');await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByRole('button',{name:'로그인',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'로그인',exact:true}).waitFor();assert.equal(data.tasks.length,1);assert.equal(photo,image);
 await page.getByLabel('이메일',{exact:true}).fill('b@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('alert').getByText(/다른 계정/).waitFor();assert.equal(state,'signed_out');assert.equal(await page.getByText('A의 기록',{exact:true}).count(),0);
 await page.getByLabel('이메일',{exact:true}).fill('a@example.com');await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('heading',{name:'Settings',exact:true,level:1}).waitFor();await page.goto('http://127.0.0.1:4176/#/tasks');await page.getByText('A의 기록',{exact:true}).waitFor();assert.equal(data.tasks.length,1);
 await page.goto('http://127.0.0.1:4176/#/profile');await page.getByRole('button',{name:'사진 제거',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.profile-summary img'));await page.reload();await page.getByRole('heading',{name:'로컬 이름',exact:true}).waitFor();assert.equal(await page.locator('.profile-summary img').count(),0);
  syncConflicts=[{entity_table:'tasks',id:data.tasks[0].id,local:data.tasks[0],remote:{revision:'2',deleted:false,payload:{...data.tasks[0],title:'Cloud task',description:'long-content-'.repeat(100)}}}];
  await page.goto('http://127.0.0.1:4176/#/sync');await page.getByRole('heading',{name:'Cloud 동기화',exact:true,level:1}).waitFor();
  await page.getByRole('button',{name:'지금 동기화',exact:true}).click();await page.getByText('전송 대기 1개 · 충돌 1개',{exact:true}).waitFor();
  await page.getByText('Cloud 내용',{exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('button',{name:'Cloud 내용 사용',exact:true}).click();await page.getByText('전송 대기 0개 · 충돌 0개',{exact:true}).waitFor();assert.equal(data.tasks[0].title,'Cloud task');
  await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});window.dispatchEvent(new Event('offline'));});
  await page.getByRole('heading',{name:'오프라인 · 전송 대기 0개',exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/native-account-profile.png',fullPage:true});
 console.log('Native UI contract: first login/signup, local restore/offline/avatar, explicit logout/data preservation, A/B isolation and same-account recovery passed. Real native Auth/system picker remains a separate gate.');
}finally{await browser?.close();server.kill('SIGTERM');}
