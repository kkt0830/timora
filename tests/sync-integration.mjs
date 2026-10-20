// Real SQLite/Rust + real PostgreSQL/RLS via the production sync service.
// Auth endpoint is a fixture; this does not claim live Supabase/device validation.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CloudSyncService } from '../src/services/cloud-sync.ts';
const pgModule=await import(process.env.TIMORA_PG_MODULE??'pg');
const {Client}=pgModule.default??pgModule;
const pg=new Client();await pg.connect();
const dir=await mkdtemp(join(tmpdir(),'timora-sync-'));
const A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002';
const processes=[],services=[];
const actualFetch=globalThis.fetch;let disconnected=false, loseAck=false;
function device(name,owner) {
 const process=spawn('src-tauri/target/debug/examples/sync_driver',[join(dir,name+'.db'),owner],{stdio:['pipe','pipe','inherit']});processes.push(process);
 const requests=[];createInterface({input:process.stdout}).on('line',line=>{const reply=JSON.parse(line);const next=requests.shift();reply.error?next.reject(Error(reply.error)):next.resolve(reply.result);});
 process.on('exit',code=>{for(const r of requests.splice(0))r.reject(Error('Fixture exited '+code));});
 const invoke=(command,args={})=>new Promise((resolve,reject)=>{requests.push({resolve,reject});process.stdin.write(JSON.stringify({command,args})+'\n');});
 const service=new CloudSyncService({url:'https://sync-fixture.supabase.co',publishableKey:'sb_publishable_fixture'},{token:async()=>owner},invoke);
 service.setAccount({id:name,local:true,local_only:false,cloud_user_id:owner});services.push(service);let state;service.subscribe(s=>state=s);
 return {invoke,service,get state(){return state;}};
}
// Serialize each SQL transaction on this isolated connection; real RLS still runs.
let tail=Promise.resolve();
globalThis.fetch=(url,init)=> {
 if(disconnected)return Promise.reject(Error('airplane mode fixture'));
 const owner=new Headers(init.headers).get('Authorization').slice(7);
 if(url.endsWith('/user'))return Promise.resolve(new Response(JSON.stringify({id:owner})));
 const body=JSON.parse(init.body);const task=tail.then(async()=>{
  await pg.query('begin');
  try {await pg.query('set local role authenticated');await pg.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
   const sql=url.endsWith('sync_apply')?'select public.sync_apply($1,$2,$3,$4,$5,$6,$7) result':'select public.sync_pull($1,$2) result';
   const params=url.endsWith('sync_apply')?[body.operation_id,body.entity_table,body.entity_id,body.action,body.payload,body.base_revision,body.base_updated_at]:[body.after_revision,body.batch_size];
   const {rows}=await pg.query(sql,params);await pg.query('commit');if(loseAck && url.endsWith('sync_apply') && body.entity_table==='notes'){loseAck=false;return Promise.reject(Error('lost committed response fixture'));}return new Response(JSON.stringify(rows[0].result));
  }catch(e){await pg.query('rollback');return new Response(JSON.stringify({message:e.message,code:e.code}),{status:/^(22|23)/.test(e.code??'')?400:500});}
 });tail=task.catch(()=>{});return task;
};
async function sync(d) {for(let i=0;i<4;i++){await d.service.wake();await new Promise(r=>setImmediate(r));if(d.state.phase!=='syncing')break;}assert.equal(d.state.phase,'idle',d.state.error);}
async function load(d,table) {return (await d.invoke('local_load'))[table];}
const note=content=>({title:'Shared note',content,project_id:null});
try {
 await pg.query('insert into auth.users(id) values($1),($2)',[A,B]);
 const phone=device('phone',A),tablet=device('tablet',A),other=device('other',B);
 await sync(phone);await sync(tablet);await sync(other);
 disconnected=true;
 const row=await phone.invoke('local_save',{table:'notes',input:note('offline first')});
 await phone.service.wake();assert.equal(phone.state.phase,'error');assert.equal((await load(phone,'notes'))[0].content,'offline first');
 disconnected=false;await sync(phone);await sync(tablet);
 assert.equal((await load(tablet,'notes'))[0].id,row.id);assert.equal((await load(tablet,'notes'))[0].content,'offline first');
 await sync(other);assert.equal((await load(other,'notes')).length,0);
 await phone.invoke('local_save',{table:'notes',id:row.id,input:note('phone edit')});
 await tablet.invoke('local_save',{table:'notes',id:row.id,input:note('tablet edit')});
 await sync(phone);await sync(tablet);
 assert.equal(tablet.state.conflict_count,1);assert.equal((await load(tablet,'notes'))[0].content,'tablet edit');
 await tablet.service.resolve('notes',row.id,'local');await sync(tablet);await sync(phone);
 assert.equal((await load(phone,'notes'))[0].content,'tablet edit');
 await phone.invoke('local_remove',{table:'notes',id:row.id});await sync(phone);await sync(tablet);
 assert.equal((await load(tablet,'notes')).length,0);
 // Also prove Project dependency fetch and all other entity shapes across devices.
 const project=await phone.invoke('local_save',{table:'projects',input:{name:'Shared project',description:'',status:'active',color:'#6b77dc'}});
 for(const [table,input] of Object.entries({tasks:{title:'T',description:'',status:'todo',priority:'high',start_date:null,due_date:'2026-10-12',project_id:project.id},events:{title:'E',description:'',start_at:'2026-10-12T09:00:00Z',end_at:'2026-10-12T10:00:00Z',project_id:project.id},library_items:{title:'L',description:'',url:'https://example.com',type:'article',project_id:project.id},inbox_items:{content:'Capture',type:'unclassified'}}))await phone.invoke('local_save',{table,input});
 await sync(phone);await sync(tablet);
 for(const table of ['projects','tasks','events','library_items','inbox_items'])assert.equal((await load(tablet,table)).length,1,table);
 // Remote parent delete while a device has an unsent child edit must become a
 // recoverable conflict rather than block all future pull behind a FK error.
 await tablet.invoke('local_remove',{table:'projects',id:project.id});await sync(tablet);
 await phone.invoke('local_save',{table:'notes',input:{...note('offline linked child'),project_id:project.id}});
 await sync(phone);assert.equal(phone.state.conflict_count,1);
 await phone.service.resolve('projects',project.id,'local');await sync(phone);await sync(tablet);
 assert.equal((await load(tablet,'notes'))[0].content,'offline linked child');
 assert.equal((await load(tablet,'projects'))[0].id,project.id);
 await phone.invoke('local_remove',{table:'projects',id:project.id});await sync(phone);await sync(tablet);
 assert.equal((await load(tablet,'tasks'))[0].project_id,null);
 // Mimic a v0.3 queued raw URL using this isolated test database only.
 const library=(await load(phone,'library_items'))[0];
 const legacy=new DatabaseSync(join(dir,'phone.db'));
 legacy.prepare('UPDATE library_items SET url=? WHERE id=?').run('https://example.com/old bad',library.id);legacy.close();
 const later=await phone.invoke('local_save',{table:'notes',input:note('not blocked by invalid URL')});
 await sync(phone);assert.equal(phone.state.failed_count,1);
 assert.equal((await pg.query('select content from public.notes where id=$1',[later.id])).rows[0].content,'not blocked by invalid URL');
 assert.ok(BigInt(phone.state.cursor)>0n);const failedId=phone.state.failures[0].operation_id;
 await phone.service.retryFailed(failedId);await sync(phone);assert.equal(phone.state.failed_count,0);
 assert.equal((await pg.query('select url from public.library_items where id=$1',[library.id])).rows[0].url,'https://example.com/old%20bad');
 // Lost acknowledgement after commit: retry keeps its original operation ID.
 const lost=await phone.invoke('local_save',{table:'notes',input:note('ack retained')});
 const before=await phone.invoke('local_sync_next',{cloudUserId:A});loseAck=true;
 await phone.service.wake();assert.equal(phone.state.phase,'error');
 assert.equal((await phone.invoke('local_sync_next',{cloudUserId:A})).operation_id,before.operation_id);
 await sync(phone);assert.equal((await pg.query('select count(*)::int n from public.notes where id=$1',[lost.id])).rows[0].n,1);
 assert.equal(phone.state.conflict_count,0);
 // An existing Cloud account connects to an untouched new device without a settings conflict.
 const C='10000000-0000-0000-0000-000000000003';await pg.query('insert into auth.users(id) values($1)',[C]);
 await pg.query('begin');await pg.query('set local role authenticated');await pg.query("select set_config('request.jwt.claim.sub',$1,true)",[C]);
 await pg.query("insert into public.workspace_settings(user_id,workspace_name,appearance) values($1,'Existing cloud','dark')",[C]);await pg.query('commit');
 const fresh=device('fresh',C);await sync(fresh);assert.equal(fresh.state.conflict_count,0);
 assert.equal((await fresh.invoke('local_load')).settings.workspace_name,'Existing cloud');
 console.log('PASS: rejected legacy URL isolated/repaired, independent writes/pull, committed response loss/idempotent retry, and fresh Cloud settings baseline');
 console.log('PASS: two real SQLite workspaces → PostgreSQL/RLS → offline retry, conflict/local choice, delete, six entities, project detachment and second-account isolation');
}finally {
 globalThis.fetch=actualFetch;for(const s of services)s.stop();for(const p of processes)p.stdin.end();
 await tail;await pg.query('delete from auth.users where id=$1 or id=$2',[A,B]);await pg.end();
 await Promise.all(processes.map(p=>new Promise(resolve=>p.exitCode!==null?resolve():p.once('exit',resolve))));await rm(dir,{recursive:true,force:true});
}
