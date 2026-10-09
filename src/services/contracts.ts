import type { EntityInput, EntityMap, EntityTable, WorkspaceData, WorkspaceSettings } from '../domain/models.ts';

export interface Account { id: string; email?: string; local?: boolean; user_metadata?: { display_name?: string } }
export interface AuthService {
  restore(): Promise<Account | null>;
  subscribe(listener: (account: Account | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, nickname?: string): Promise<boolean>;
  signOut(): Promise<void>;
  token(forceRefresh?: boolean): Promise<string>;
}
export interface WorkspaceRepository {
  load(userId: string): Promise<WorkspaceData>;
  save<K extends EntityTable>(table: K, userId: string, input: EntityInput<K>, id?: string): Promise<EntityMap[K]>;
  remove(table: EntityTable, userId: string, id: string): Promise<void>;
  convertInbox(userId: string, id: string, target: 'task' | 'note'): Promise<void>;
  saveSettings(settings: WorkspaceSettings): Promise<WorkspaceSettings>;
}
