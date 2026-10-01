export type ObjectKind = 'task' | 'note' | 'event' | 'project' | 'resource';
export type RelationKind = 'belongs_to' | 'references' | 'depends_on';
// Reserved contract for v0.3; v0.1 uses explicit project_id relationships.
export interface ObjectRelation { id: string; sourceId: string; targetId: string; kind: RelationKind }
export interface OwnedEntity { id: string; user_id: string; created_at: string; updated_at: string }
export interface Task extends OwnedEntity {
  title: string; description: string; status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high'; start_date: string | null; due_date: string | null; project_id: string | null;
}
export interface Note extends OwnedEntity { title: string; content: string; project_id: string | null }
export interface Project extends OwnedEntity { name: string; description: string; status: 'active' | 'paused' | 'completed'; color: string }
export interface CalendarEvent extends OwnedEntity { title: string; description: string; start_at: string; end_at: string; project_id: string | null }
export type LibraryType = 'website' | 'article' | 'github' | 'video' | 'pdf' | 'file' | 'other';
export interface LibraryItem extends OwnedEntity { title: string; url: string; type: LibraryType; description: string; project_id: string | null }
export interface InboxItem extends OwnedEntity { content: string; type: 'unclassified' | ObjectKind }
export interface WorkspaceSettings { user_id: string; workspace_name: string; appearance: 'light' | 'dark' | 'system'; updated_at: string }
export interface EntityMap { tasks: Task; notes: Note; projects: Project; events: CalendarEvent; library_items: LibraryItem; inbox_items: InboxItem }
export type EntityTable = keyof EntityMap;
export type EntityInput<K extends EntityTable> = Omit<EntityMap[K], keyof OwnedEntity>;
export interface WorkspaceData { tasks: Task[]; notes: Note[]; projects: Project[]; events: CalendarEvent[]; library_items: LibraryItem[]; inbox_items: InboxItem[]; settings: WorkspaceSettings }
export const entityTables: EntityTable[] = ['tasks', 'notes', 'projects', 'events', 'library_items', 'inbox_items'];
export function emptyWorkspace(user_id: string): WorkspaceData {
  return { tasks: [], notes: [], projects: [], events: [], library_items: [], inbox_items: [], settings: { user_id, workspace_name: 'My Workspace', appearance: 'system', updated_at: '' } };
}
