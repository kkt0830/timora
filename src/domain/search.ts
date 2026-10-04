import type { EntityTable, WorkspaceData } from './models.ts';
export interface SearchResult { id: string; table: EntityTable; title: string; context: string; project: string; metadata: string }
export function searchWorkspace(data: WorkspaceData, query: string): SearchResult[] {
  const terms = query.trim().normalize('NFKC').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const result: SearchResult[] = [];
  for (const table of ['tasks', 'notes', 'projects', 'library_items', 'inbox_items', 'events'] as const) {
    for (const row of data[table]) {
      const title = 'name' in row ? row.name : 'title' in row ? row.title : row.content.split('\n')[0];
      const context = 'content' in row ? row.content : row.description;
      const project = 'project_id' in row ? data.projects.find(p => p.id === row.project_id)?.name ?? '개인 항목' : '';
      const metadata = 'url' in row ? `${row.type} · ${row.url}` : 'due_date' in row ? `${row.status} · ${row.due_date ?? '날짜 없음'}` : 'start_at' in row ? row.start_at : 'status' in row ? row.status : row.updated_at;
      const text = `${title} ${context} ${project} ${metadata}`.normalize('NFKC').toLocaleLowerCase();
      if (terms.every(term => text.includes(term))) result.push({ id: row.id, table, title, context: context.slice(0, 180), project, metadata });
    }
  }
  return result;
}
