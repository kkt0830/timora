import type { UserQuote } from './models.ts';
export interface QuoteText { id:string; content:string; author:string }
// Original Timora copy; no third-party quotations or song lyrics.
export const bundledQuotes: QuoteText[] = [
 '오늘의 작은 기록은 내일의 출발점이 됩니다.', '모든 일을 끝내지 않아도 한 걸음은 남습니다.',
 '쉬는 시간도 나의 시간을 돌보는 방법입니다.', '생각을 적으면 다음 행동이 조금 더 선명해집니다.',
 '속도보다 나에게 맞는 방향을 확인해 보세요.', '다시 시작하는 날에도 어제의 경험은 남아 있습니다.',
 '작은 약속 하나를 지키는 것으로 시작해도 좋습니다.', '비워 둔 여백에 새로운 생각이 들어올 수 있습니다.',
 '완벽한 계획보다 오늘 할 수 있는 한 가지를 찾아보세요.', '기록은 평가가 아니라 나를 이해하는 단서입니다.',
 '큰 목표도 오늘의 작은 선택에서 시작됩니다.', '잠시 멈추고 지금 필요한 것을 살펴보세요.',
].map((content,i)=>({id:`timora-${i}`,content,author:'Timora'}));
export type QuoteMode='mixed'|'bundled'|'personal';
export function dailyQuote(day:string,mode:QuoteMode,user:UserQuote[],previous?:string):QuoteText {
 const pool=[...(mode==='personal'?[]:bundledQuotes),...(mode==='bundled'?[]:user.map(q=>({id:q.id,content:q.content,author:q.author})))].sort((a,b)=>a.id.localeCompare(b.id));
 const candidates=pool.length>1?pool.filter(q=>q.id!==previous):pool;
 const source=candidates.length?candidates:bundledQuotes;
 let hash=2166136261;for(const c of day)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return source[(hash>>>0)%source.length];
}
