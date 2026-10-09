-- Preserve the singleton UUID, entity ownership and import marker.
ALTER TABLE local_identity ADD COLUMN access_state TEXT NOT NULL DEFAULT 'local_only' CHECK(access_state IN ('new','local_only','signed_in','signed_out'));
ALTER TABLE local_identity ADD COLUMN email TEXT;
ALTER TABLE local_identity ADD COLUMN cloud_project_url TEXT;
ALTER TABLE local_identity ADD COLUMN last_authenticated_at TEXT;
ALTER TABLE local_identity ADD COLUMN created_at TEXT;
ALTER TABLE local_identity ADD COLUMN local_avatar TEXT;
UPDATE local_identity SET created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');
