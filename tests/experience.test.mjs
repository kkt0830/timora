import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace } from '../src/domain/models.ts';
import { searchWorkspace } from '../src/domain/search.ts';
import { displayName, safeAvatarUrl } from '../src/domain/identity.ts';
test('Search finds content, URL and project context, normalizes text and combines terms', () => {
  const data = emptyWorkspace('a');
  const owned = { id: 'n', user_id: 'a', created_at: '', updated_at: '' };
  data.projects = [{ ...owned, id: 'p', name: 'Timora', description: '', status: 'active', color: '#0066cc' }];
  data.notes = [{ ...owned, title: '회의', content: 'ＡＰＩ 설계', project_id: 'p' }];
  data.library_items = [{ ...owned, title: '참고', url: 'https://example.com/design', type: 'website', description: '', project_id: null }];
  assert.equal(searchWorkspace(data, 'api timora')[0].table, 'notes');
  assert.equal(searchWorkspace(data, 'example.com')[0].table, 'library_items');
  assert.equal(searchWorkspace(data, 'unmatched').length, 0);
  assert.equal(searchWorkspace(data, '   ').length, 0);
  assert.equal(searchWorkspace(emptyWorkspace('b'), 'api').length, 0);
});
test('Profile rejects blank/oversized names and unsafe image URLs', () => {
  assert.equal(displayName(' 이름 '), '이름');
  assert.throws(() => displayName(' ')); assert.throws(() => displayName('a'.repeat(65)));
  for (const url of ['javascript:alert(1)', 'data:image/png,x', 'http://example.com', 'https://user:password@example.com', 'bad']) assert.equal(safeAvatarUrl(url), null);
  assert.equal(safeAvatarUrl('https://example.com/image.png'), 'https://example.com/image.png');
});
