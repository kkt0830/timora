-- Additive v0.4 checkpoint. Preserve core rows, identity and all delivery metadata.
CREATE UNIQUE INDEX tasks_id_owner ON tasks(id,user_id);
CREATE TABLE subtasks (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
 task_id TEXT NOT NULL, title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300),
 status TEXT NOT NULL CHECK(status IN ('todo','done')),
 position INTEGER NOT NULL CHECK(typeof(position)='integer' AND position BETWEEN 0 AND 2147483647),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 remote_updated_at TEXT, sync_state TEXT NOT NULL DEFAULT 'local' CHECK(sync_state IN ('local','imported','modified')),
 FOREIGN KEY(task_id,user_id) REFERENCES tasks(id,user_id) ON DELETE CASCADE
);
CREATE INDEX subtasks_parent_order ON subtasks(task_id,position,id);
CREATE INDEX subtasks_updated ON subtasks(updated_at,id);
CREATE TRIGGER sync_subtasks_insert AFTER INSERT ON subtasks WHEN (SELECT applying FROM native_sync_control)=0 BEGIN
INSERT INTO native_sync_outbox(entity_table,id,action,payload,base_revision,base_updated_at) VALUES('subtasks',NEW.id,'put',json_object('id',NEW.id,'user_id',NEW.user_id,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'task_id',NEW.task_id,'title',NEW.title,'status',NEW.status,'position',NEW.position),(SELECT revision FROM native_sync_meta WHERE entity_table='subtasks' AND id=NEW.id),COALESCE((SELECT remote_updated_at FROM native_sync_meta WHERE entity_table='subtasks' AND id=NEW.id),NEW.remote_updated_at)); END;
CREATE TRIGGER sync_subtasks_update AFTER UPDATE ON subtasks WHEN (SELECT applying FROM native_sync_control)=0 BEGIN
INSERT INTO native_sync_outbox(entity_table,id,action,payload,base_revision,base_updated_at) VALUES('subtasks',NEW.id,'put',json_object('id',NEW.id,'user_id',NEW.user_id,'created_at',NEW.created_at,'updated_at',NEW.updated_at,'task_id',NEW.task_id,'title',NEW.title,'status',NEW.status,'position',NEW.position),(SELECT revision FROM native_sync_meta WHERE entity_table='subtasks' AND id=NEW.id),COALESCE((SELECT remote_updated_at FROM native_sync_meta WHERE entity_table='subtasks' AND id=NEW.id),NEW.remote_updated_at)); END;
CREATE TRIGGER sync_subtasks_delete AFTER DELETE ON subtasks WHEN (SELECT applying FROM native_sync_control)=0 BEGIN
INSERT INTO native_sync_outbox(entity_table,id,action,base_revision,base_updated_at) VALUES('subtasks',OLD.id,'delete',(SELECT revision FROM native_sync_meta WHERE entity_table='subtasks' AND id=OLD.id),COALESCE((SELECT remote_updated_at FROM native_sync_meta WHERE entity_table='subtasks' AND id=OLD.id),OLD.remote_updated_at)); END;
