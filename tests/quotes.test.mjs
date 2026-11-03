import assert from 'node:assert/strict';
import test from 'node:test';
import { bundledQuotes, dailyQuote } from '../src/domain/quotes.ts';
test('daily quote selection is stable, excludes previous when possible and has an empty-personal fallback',()=>{
 const user=[{id:'a',content:'my words',author:'me',favorite:0},{id:'b',content:'another',author:'me',favorite:1}];
 const first=dailyQuote('2026-11-02','mixed',user);assert.deepEqual(dailyQuote('2026-11-02','mixed',user),first);
 assert.notEqual(dailyQuote('2026-11-03','mixed',user,first.id).id,first.id);
 assert.ok(bundledQuotes.some(q=>q.id===dailyQuote('2026-11-02','personal',[]).id));
 assert.ok(user.some(q=>q.id===dailyQuote('2026-11-02','personal',user).id));
 assert.ok(bundledQuotes.some(q=>q.id===dailyQuote('2026-11-02','bundled',user).id));
});
