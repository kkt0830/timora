import type { EntityTable, WorkspaceData } from './models.ts';
export interface SearchResult { id: string; table: Extract<EntityTable, 'tasks' | 'notes' | 'projects' | 'events' | 'library_items' | 'inbox_items'>; title: string; context: string; project: string; metadata: string }
export function searchWorkspace(data: WorkspaceData, query: string): SearchResult[] {
  const terms = query.trim().normalize('NFKC').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const result: SearchResult[] = [];
  const projects=new Map(data.projects.map(p=>[p.id,p.name]));
  const tagsById=new Map((data.tags??[]).map(t=>[t.id,t.name]));
  const noteTags=new Map<string,string[]>();
  for(const link of data.note_tags??[]){const names=noteTags.get(link.note_id)??[];names.push(tagsById.get(link.tag_id)??'');noteTags.set(link.note_id,names);}
  for (const table of ['tasks', 'notes', 'projects', 'library_items', 'inbox_items', 'events'] as const) {
    for (const row of data[table]) {
      const title = 'name' in row ? row.name : 'title' in row ? row.title : row.content.split('\n')[0];
      const context = 'content' in row ? row.content : row.description;
      const project = 'project_id' in row ? projects.get(row.project_id??'') ?? '개인 항목' : '';
      const metadata = 'url' in row ? `${row.type} · ${row.url}` : 'due_date' in row ? `${row.status} · ${row.due_date ?? '날짜 없음'}` : 'start_at' in row ? row.start_at : 'status' in row ? row.status : row.updated_at;
      const tags = table === 'notes' ? (noteTags.get(row.id)??[]).join(' ') : '';
      const text = `${title} ${context} ${project} ${metadata} ${tags}`.normalize('NFKC').toLocaleLowerCase();
      if (terms.every(term => text.includes(term))) result.push({ id: row.id, table, title, context: context.slice(0, 180), project, metadata });
    }
  }
  return result;
}
