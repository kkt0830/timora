import type { Attachment } from '../domain/models';
export const FILE_LIMIT=25*1024*1024;
export function encodeBytes(bytes:Uint8Array):string{let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
export function decodeBytes(base64:string):Uint8Array{return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}
export async function verifyAttachment(row:Attachment,bytes:Uint8Array):Promise<void>{if(bytes.length!==row.byte_size||bytes.length>FILE_LIMIT)throw new Error('첨부파일 크기가 일치하지 않습니다.');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==row.sha256)throw new Error('첨부파일 체크섬이 일치하지 않습니다.');}
export async function transferAttachment(config:{url:string;key:string;token:()=>Promise<string>},owner:string,row:Attachment,upload?:Uint8Array):Promise<Uint8Array|null>{
 if(!/^[0-9a-f-]{36}$/i.test(owner)||!/^[0-9a-f-]{36}$/i.test(row.id)||!/^[0-9a-f]{64}$/.test(row.sha256))throw new Error('파일 전송 대상 오류');
 if(!config.url.startsWith('https://')||!config.key)throw new Error('Cloud 파일 저장소 설정이 필요합니다. 로컬 파일은 보존됩니다.');
 const path=`${config.url.replace(/\/$/,'')}/storage/v1/object/${upload?'':'authenticated/'}timora-attachments/${owner}/${row.id}/${row.sha256}`;
 const headers={apikey:config.key,Authorization:`Bearer ${await config.token()}`};
 if(upload){await verifyAttachment(row,upload);const response=await fetch(path,{method:'POST',headers:{...headers,'Content-Type':row.mime,'x-upsert':'false'},body:upload,signal:AbortSignal.timeout(120000),redirect:'error'});if(response.ok)return null;if(response.status===400||response.status===409){try{await transferAttachment(config,owner,row);return null;}catch{/* Preserve an explicit upload failure if the existing object cannot be verified. */}}throw new Error(`Cloud 업로드 실패 (${response.status}). 비공개 저장소·권한·용량을 확인한 뒤 다시 시도하세요. 로컬 파일은 남아 있습니다.`);}
 const response=await fetch(path,{headers,signal:AbortSignal.timeout(120000),redirect:'error'});if(!response.ok)throw new Error(`Cloud 다운로드 실패 (${response.status}). 원래 기기의 업로드 완료 여부를 확인해 주세요.`);
 if(Number(response.headers.get('content-length')??0)>FILE_LIMIT)throw new Error('파일 크기 제한 초과');
 const reader=response.body?.getReader();if(!reader)throw new Error('파일 응답을 읽을 수 없습니다.');const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>FILE_LIMIT||size>row.byte_size)throw new Error('파일 크기 제한 초과');chunks.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}await verifyAttachment(row,bytes);return bytes;
}
