export type ObjectKind = 'task' | 'note' | 'event' | 'project' | 'resource';
export type RelationKind = 'belongs_to' | 'references' | 'depends_on';
export interface ObjectRelation extends OwnedEntity { source_id: string; source_kind: ObjectKind; target_id: string; target_kind: ObjectKind; kind: RelationKind }
export interface UserQuote extends OwnedEntity { content: string; author: string; favorite: number }
export interface OwnedEntity { id: string; user_id: string; created_at: string; updated_at: string }
export interface Task extends OwnedEntity {
  title: string; description: string; status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high'; start_date: string | null; due_date: string | null; project_id: string | null;
}
export interface Subtask extends OwnedEntity { task_id: string; title: string; status: 'todo' | 'done'; position: number }
export interface Routine extends OwnedEntity { title: string; description: string; frequency: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'; interval_days: number; start_date: string; end_date: string | null; occurrence_limit: number | null; weekdays: string; timezone: string; status: 'active' | 'paused' | 'archived'; reminder_time: string | null; category: string }
export interface RoutineCompletion extends OwnedEntity { routine_id: string; local_date: string; status: 'todo' | 'done' }
export interface Tag extends OwnedEntity { name: string; color: string }
export interface NoteTag extends OwnedEntity { note_id: string; tag_id: string }
export interface NoteTemplate extends OwnedEntity { title: string; content: string }
export interface TaskBlock extends OwnedEntity { task_id: string; start_at: string; end_at: string }
export interface BoardPosition extends OwnedEntity { task_id: string; position: number }
export const workspaceToolTables = ['tags', 'note_tags', 'note_templates', 'task_blocks', 'board_positions'] as const;
export interface TaskRecurrence extends Routine { priority: Task['priority']; project_id: string | null }
export interface TaskOccurrence extends OwnedEntity { recurrence_id: string; local_date: string; task_id: string }
export interface Note extends OwnedEntity { title: string; content: string; project_id: string | null }
export interface Project extends OwnedEntity { name: string; description: string; status: 'active' | 'paused' | 'completed'; color: string }
export interface CalendarEvent extends OwnedEntity { title: string; description: string; start_at: string; end_at: string; project_id: string | null }
export type LibraryType = 'website' | 'article' | 'github' | 'video' | 'pdf' | 'file' | 'other';
export interface LibraryItem extends OwnedEntity { title: string; url: string; type: LibraryType; description: string; project_id: string | null }
export interface InboxItem extends OwnedEntity { content: string; type: 'unclassified' | ObjectKind }
export interface WorkspaceSettings { user_id: string; workspace_name: string; appearance: 'light' | 'dark' | 'system'; display_name: string; avatar_url: string | null; updated_at: string }
export interface EntityMap { object_relations: ObjectRelation; user_quotes: UserQuote; task_recurrences: TaskRecurrence; task_occurrences: TaskOccurrence; tags: Tag; note_tags: NoteTag; note_templates: NoteTemplate; task_blocks: TaskBlock; board_positions: BoardPosition; routines: Routine; routine_completions: RoutineCompletion; subtasks: Subtask; tasks: Task; notes: Note; projects: Project; events: CalendarEvent; library_items: LibraryItem; inbox_items: InboxItem }
export type EntityTable = keyof EntityMap;
export type EntityInput<K extends EntityTable> = Omit<EntityMap[K], keyof OwnedEntity>;
export interface WorkspaceData { extras_available: boolean; object_relations: ObjectRelation[]; user_quotes: UserQuote[]; recurrence_available: boolean; task_recurrences: TaskRecurrence[]; task_occurrences: TaskOccurrence[]; tools_available: boolean; tags: Tag[]; note_tags: NoteTag[]; note_templates: NoteTemplate[]; task_blocks: TaskBlock[]; board_positions: BoardPosition[]; routines: Routine[]; routine_completions: RoutineCompletion[]; routines_available: boolean; subtasks: Subtask[]; subtasks_available: boolean; tasks: Task[]; notes: Note[]; projects: Project[]; events: CalendarEvent[]; library_items: LibraryItem[]; inbox_items: InboxItem[]; settings: WorkspaceSettings }
export const entityTables: EntityTable[] = ['tasks', 'notes', 'projects', 'events', 'library_items', 'inbox_items'];
export function emptyWorkspace(user_id: string): WorkspaceData {
  return { extras_available: false, object_relations: [], user_quotes: [], recurrence_available: false, task_recurrences: [], task_occurrences: [], tools_available: false, tags: [], note_tags: [], note_templates: [], task_blocks: [], board_positions: [], routines: [], routine_completions: [], routines_available: false, subtasks: [], subtasks_available: false, tasks: [], notes: [], projects: [], events: [], library_items: [], inbox_items: [], settings: { user_id, workspace_name: 'My Workspace', appearance: 'system', display_name: '', avatar_url: null, updated_at: '' } };
}
