import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalAuth } from '../src/data/local-repository.ts';
import { CloudImportService } from '../src/services/cloud-import.ts';
const config={url:'https://test.supabase.co',publishableKey:'sb_publishable_fixture'};
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const local={id:'local-uuid',local:true,local_only:false,cloud_user_id:A,email:'A@example.com'};
const response=(body,status=200)=>new Response(status===204?null:JSON.stringify(body),{status});
test('Native restart restores identity without HTTP or persistent token storage; failed refresh preserves it',async()=>{
 const mock=test.mock.method(globalThis,'fetch',async()=>{throw new Error('offline');});
 try { const auth=new LocalAuth(async()=>({...local}),config); const seen=[];auth.subscribe(a=>seen.push(a));
  assert.equal((await auth.restore()).id,local.id);assert.equal(mock.mock.callCount(),0);
  assert.equal(seen.at(-1).cloud_state,'CLOUD_REAUTH_REQUIRED');await assert.rejects(auth.token());
  assert.equal(seen.at(-1).id,local.id);assert.equal((await auth.restore()).cloud_user_id,A);
 }finally{mock.mock.restore();}
});
test('Native first login verifies server identity and stores refresh only through the secure vault IPC',async()=>{
 const calls=[];let identity=null;
 const mock=test.mock.method(globalThis,'fetch',async url=>response({access_token:'memory-access',refresh_token:'memory-refresh',expires_in:3600,user:{id:A,email:local.email}}));
 try { const auth=new LocalAuth(async(command,args)=>{calls.push({command,args}); if(command==='local_bind_account'){assert.deepEqual(args,{accessToken:'memory-access'});identity={...local};}return identity;},config);
  assert.equal(await auth.restore(),null);await auth.signIn(local.email,'never-persist-password');
  assert.equal((await auth.restore()).cloud_state,'SIGNED_IN_ONLINE');assert.ok(calls.every(c=>!JSON.stringify(c).includes('never-persist-password')));
  assert.deepEqual(calls.find(c=>c.command==='local_session_write').args,{refreshToken:'memory-refresh'});
  assert.ok(calls.filter(c=>c.command!=='local_session_write').every(c=>!JSON.stringify(c).includes('memory-refresh')));
  const restarted=new LocalAuth(async()=>identity,config);assert.equal((await restarted.restore()).id,local.id);await assert.rejects(restarted.token(),/로그인/);
 }finally{mock.mock.restore();}
});
test('Rejected Cloud refresh changes only Cloud status; native account and workspace stay signed in',async()=>{
 let reject=false;const seen=[];
 const mock=test.mock.method(globalThis,'fetch',async()=>reject?response({message:'expired'},401):response({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:A,email:local.email}}));
 try {const auth=new LocalAuth(async()=>({...local}),config);auth.subscribe(a=>seen.push(a));await auth.signIn(local.email,'fixture');reject=true;await assert.rejects(auth.token(true));
  assert.equal(seen.at(-1).cloud_state,'CLOUD_REAUTH_REQUIRED');assert.equal(seen.at(-1).id,local.id);
 }finally{mock.mock.restore();}
});
test('Native explicit logout locks local identity even when remote logout is unavailable; failed local lock stays visible',async()=>{
 const mock=test.mock.method(globalThis,'fetch',async url=>url.includes('/logout')?Promise.reject(new Error('offline')):response({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:A,email:local.email}}));
 let signedOut=false,fail=false;const seen=[];
 try {const auth=new LocalAuth(async(command)=>{if(command==='local_sign_out'){if(fail)throw new Error('DB lock failed');signedOut=true;return null;}return signedOut?null:{...local};},config);auth.subscribe(a=>seen.push(a));
  await auth.signIn(local.email,'fixture');fail=true;await assert.rejects(auth.signOut(),/DB lock failed/);assert.equal(seen.at(-1).id,local.id);
  fail=false;await auth.signOut();assert.equal(seen.at(-1),null);assert.equal(await auth.restore(),null);
 }finally{mock.mock.restore();}
});
test('Wrong account binding rejection preserves the current local account; cloud import stops before reading other owner data',async()=>{
 const urls=[];const mock=test.mock.method(globalThis,'fetch',async url=>{urls.push(url);if(url.includes('/logout'))return response(null,204);if(url.endsWith('/user'))return response({id:B,email:'B@example.com'});return response({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:B,email:'B@example.com'}});});
 try {const auth=new LocalAuth(async(command)=>{if(command==='local_bind_account')throw new Error('다른 계정');return {...local};},config);await auth.restore();await assert.rejects(auth.signIn('B@example.com','fixture'),/다른 계정/);
  assert.equal((await auth.restore()).cloud_user_id,A);await assert.rejects(new CloudImportService(config).preview('B@example.com','fixture',A),/다른 계정/);assert.ok(urls.every(url=>!url.includes('/rest/v1/')));
 }finally{mock.mock.restore();}
});
test('Native signup uses configured Site URL and email confirmation does not unlock local workspace',async()=>{
 let request='';const mock=test.mock.method(globalThis,'fetch',async url=>{request=url;return response({user:{id:A}});});
 try {const auth=new LocalAuth(async()=>null,config);assert.equal(await auth.signUp('A@example.com','fixture','Name'),false);assert.ok(!request.includes('redirect_to'));assert.equal(await auth.restore(),null);
 }finally{mock.mock.restore();}
});
test('A delayed remote logout cannot clear a newer native Cloud login',async()=>{
 let release;const logoutResponse=new Promise(resolve=>release=resolve);
 const mock=test.mock.method(globalThis,'fetch',async url=>url.includes('/logout')?logoutResponse:response({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600,user:{id:A,email:local.email}}));
 try {const auth=new LocalAuth(async()=>({...local}),config);await auth.signIn(local.email,'fixture');const pending=auth.signOut();await new Promise(r=>setImmediate(r));await auth.signIn(local.email,'fixture');release(response(null,204));await pending;assert.equal(await auth.token(),'new-access');}
 finally{mock.mock.restore();}
});
test('An old restore response cannot reopen the UI after explicit local logout',async()=>{
 let release;const restore=new Promise(resolve=>release=resolve);let count=0;
 const auth=new LocalAuth(async command=>command==='local_account'&&count++===0?restore:null,config);
 const pending=auth.restore();await auth.signOut();release({...local});assert.equal(await pending,null);
});
