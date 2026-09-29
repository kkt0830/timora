// UI-facing contracts. These are conceptual, not a database schema or migration.
export type ObjectKind = 'task' | 'note' | 'event' | 'project' | 'resource';
export type ObjectId = string;
export type RelationKind = 'belongs_to' | 'references' | 'depends_on';

export interface WorkspaceObject {
  id: ObjectId;
  kind: ObjectKind;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface ObjectRelation {
  id: string;
  sourceId: ObjectId;
  targetId: ObjectId;
  kind: RelationKind;
}

export interface Task extends WorkspaceObject {
  kind: 'task';
  status: 'todo' | 'in_progress' | 'done';
  dueAt?: string;
  projectId?: ObjectId;
  priority: 'low' | 'medium' | 'high';
}

export interface Note extends WorkspaceObject {
  kind: 'note';
  excerpt: string;
  category: string;
}

export interface Project extends WorkspaceObject {
  kind: 'project';
  description: string;
  progress: number;
  color: string;
}

export interface CalendarEvent extends WorkspaceObject {
  kind: 'event';
  startsAt: string;
  endsAt: string;
  projectId?: ObjectId;
}

export interface LibraryResource extends WorkspaceObject {
  kind: 'resource';
  resourceType: 'document' | 'link' | 'file';
  description: string;
}

export interface InboxItem {
  id: string;
  content: string;
  capturedAt: string;
  processed: boolean;
}
