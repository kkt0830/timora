-- Additive local migration; preserve all user rows and existing delivery IDs.
ALTER TABLE native_sync_outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE native_sync_outbox ADD COLUMN last_error TEXT;
ALTER TABLE native_sync_outbox ADD COLUMN failed_at TEXT;
-- Existing installations may contain real offline preferences: preserve them.
ALTER TABLE native_sync_control ADD COLUMN settings_initialized INTEGER NOT NULL DEFAULT 1;
-- A never-authenticated installation cannot contain user-edited preferences.
UPDATE native_sync_control SET settings_initialized=0 WHERE EXISTS(SELECT 1 FROM local_identity WHERE access_state='new');
DELETE FROM native_sync_outbox WHERE entity_table='workspace_settings' AND (SELECT settings_initialized FROM native_sync_control)=0;
CREATE INDEX sync_outbox_entity_sequence ON native_sync_outbox(entity_table,id,seq);
DROP TRIGGER sync_settings_update;
CREATE TRIGGER sync_settings_update AFTER UPDATE ON workspace_settings
WHEN (SELECT applying FROM native_sync_control)=0 AND (SELECT settings_initialized FROM native_sync_control)=1 BEGIN
INSERT INTO native_sync_outbox(entity_table,id,action,payload,base_revision,base_updated_at)
VALUES('workspace_settings','settings','put',json_object('user_id',NEW.user_id,'workspace_name',NEW.workspace_name,'appearance',NEW.appearance,'display_name',NEW.display_name,'avatar_url',NEW.avatar_url,'updated_at',NEW.updated_at),(SELECT revision FROM native_sync_meta WHERE entity_table='workspace_settings' AND id='settings'),(SELECT remote_updated_at FROM native_sync_meta WHERE entity_table='workspace_settings' AND id='settings'));
END;
