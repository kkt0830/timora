-- Additive v0.2 migration. Existing settings, owners and RLS remain unchanged.
-- CLI migration generation was unavailable in the managed read-only home.
begin;
set local lock_timeout = '5s';
alter table public.workspace_settings
  add column display_name text not null default '',
  add column avatar_url text;
alter table public.workspace_settings
  add constraint settings_display_name_length check (char_length(display_name) <= 64),
  add constraint settings_avatar_https check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://'));
commit;
