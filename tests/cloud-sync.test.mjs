import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudSyncService, emptySyncState } from '../src/services/cloud-sync.ts';
import { LocalAuth } from '../src/data/local-repository.ts';
const A='11111111-1111-4111-8111-111111111111';
const config={url:'https://sync-fixture.supabase.co',publishableKey:'sb_publishable_fixture'};
const account={id:'local',local:true,local_only:false,cloud_user_id:A};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
function fixture(operations=[]) {
 const queue=[...operations],calls=[];let cursor='0';
 const invoke=async(command,args)=>{
  calls.push({command,args});
  if(command==='local_sync_status')return {...emptySyncState,pending:queue.length,cursor};
  if(command==='local_sync_next')return queue[0]??null;
  if(command==='local_sync_ack'){queue.shift();return;}
  if(command==='local_sync_page'){cursor=args.page.cursor;return true;}
  throw new Error('unexpected IPC '+command);
 };
 const service=new CloudSyncService(config,{token:async()=> 'fixture-access'},invoke);
 service.setAccount(account);let state;service.subscribe(s=>state=s);
 return {service,queue,calls,get state(){return state;}};
}
const operation={operation_id:'33333333-3333-4333-8333-333333333333',entity_table:'notes',id:'44444444-4444-4444-8444-444444444444',action:'put',payload:{title:'offline'},base_revision:null,base_updated_at:null};
test('push is single-flight, retries a retained operation and acknowledges only a successful server reply',async()=>{
 const f=fixture([operation]);let fail=true;const bodies=[];
 const mock=test.mock.method(globalThis,'fetch',async(url,init)=>{
  if(url.endsWith('/user'))return response({id:A});
  const body=JSON.parse(init.body);bodies.push(body);
  if(url.endsWith('sync_apply')) {if(fail)throw Error('disconnected');return response({status:'applied',record:{}});}
  return response({cursor:'1',records:[],dependencies:[],has_more:false});
 });
 try {
  const first=f.service.wake();assert.equal(f.service.wake(),first);await first;
  assert.equal(f.queue.length,1);assert.equal(f.state.phase,'error');
  fail=false;await f.service.wake();assert.equal(f.queue.length,0);assert.equal(f.state.phase,'idle');
  assert.equal(bodies[0].operation_id,bodies[1].operation_id);
  assert.ok(f.calls.findIndex(c=>c.command==='local_sync_ack')<f.calls.findIndex(c=>c.command==='local_sync_page'));
 }finally{mock.mock.restore();f.service.stop();}
});
test('a restored credential belonging to another account cannot upload any queued record',async()=>{
 const f=fixture([operation]);const mock=test.mock.method(globalThis,'fetch',async()=>response({id:'other-owner'}));
 try {await f.service.wake();assert.equal(f.state.phase,'auth_required');assert.equal(f.queue.length,1);assert.equal(mock.mock.callCount(),1);assert.ok(!f.calls.some(c=>c.command==='local_sync_next'));}
 finally{mock.mock.restore();f.service.stop();}
});
test('local-only and offline workspaces keep pending data without touching HTTP',async()=>{
 const f=fixture([operation]);const mock=test.mock.method(globalThis,'fetch',async()=>{throw Error('unexpected HTTP');});
 const previous=Object.getOwnPropertyDescriptor(globalThis.navigator,'onLine');
 Object.defineProperty(globalThis.navigator,'onLine',{value:false,configurable:true});
 try {await f.service.wake();assert.equal(f.state.phase,'offline');f.service.setAccount({...account,local_only:true});await f.service.wake();assert.equal(f.state.phase,'local_only');assert.equal(f.queue.length,1);assert.equal(mock.mock.callCount(),0);}
 finally{if(previous)Object.defineProperty(globalThis.navigator,'onLine',previous);else delete globalThis.navigator.onLine;mock.mock.restore();f.service.stop();}
});
test('logout aborts pending responses and a new cycle can run without waiting for the obsolete request',async()=>{
 const f=fixture([operation]);let release;let count=0;
 const old=new Promise(r=>release=r);
 const mock=test.mock.method(globalThis,'fetch',async url=>{
  if(url.endsWith('/user'))return ++count===1?old:response({id:A});
  if(url.endsWith('sync_apply'))return response({status:'applied',record:{}});
  return response({cursor:'1',records:[],dependencies:[],has_more:false});
 });
 try {const pending=f.service.wake();await new Promise(r=>setImmediate(r));f.service.stop();f.service.setAccount(account);await f.service.wake();release(response({id:A}));await pending;
  assert.equal(f.queue.length,0);assert.equal(f.calls.filter(c=>c.command==='local_sync_ack').length,1);assert.equal(f.state.phase,'idle');
 }finally{mock.mock.restore();f.service.stop();}
});
test('secure native credential restores lazily, rotates in the vault and never delays offline workspace restore',async()=>{
 let release;const read=new Promise(r=>release=r);const calls=[];
 const auth=new LocalAuth(async(command,args)=>{calls.push({command,args});if(command==='local_account')return account;if(command==='local_session_read')return read;},config);
 const mock=test.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.ok(url.endsWith('grant_type=refresh_token'));assert.equal(JSON.parse(init.body).refresh_token,'vault-refresh');
  return response({access_token:'new-access',refresh_token:'rotated-refresh',expires_in:3600,user:{id:A}});
 });
 try {assert.equal((await auth.restore()).id,'local');assert.equal(mock.mock.callCount(),0);const token=auth.token();release('vault-refresh');assert.equal(await token,'new-access');assert.deepEqual(calls.find(c=>c.command==='local_session_write').args,{refreshToken:'rotated-refresh'});}
 finally{mock.mock.restore();}
});
