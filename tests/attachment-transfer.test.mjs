import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {verifyAttachment,transferAttachment,encodeBytes,decodeBytes} from '../src/services/attachment-transfer.ts';
test('attachment transport verifies bytes independently of metadata and retries duplicate immutable uploads',async()=>{
 const bytes=new TextEncoder().encode('fixture');const row={id:'11111111-1111-4111-8111-111111111111',byte_size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),mime:'text/plain'};
 assert.deepEqual(decodeBytes(encodeBytes(bytes)),bytes);await verifyAttachment(row,bytes);await assert.rejects(verifyAttachment(row,new TextEncoder().encode('changed')));
 const original=globalThis.fetch;const seen=[];globalThis.fetch=async(url,init)=>{seen.push({url,init});return init.method==='POST'?new Response('{}',{status:400}):new Response(bytes);};
 try{await transferAttachment({url:'https://fixture.supabase.co',key:'public-fixture',token:async()=>'fixture-token'},'22222222-2222-4222-8222-222222222222',row,bytes);assert.equal(seen.length,2);assert.ok(seen[1].url.includes('/authenticated/timora-attachments/22222222'));globalThis.fetch=async()=>new Response('corrupt');await assert.rejects(transferAttachment({url:'https://fixture.supabase.co',key:'public-fixture',token:async()=>'fixture-token'},'22222222-2222-4222-8222-222222222222',row));}finally{globalThis.fetch=original;}
});
