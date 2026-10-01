-- Timora v0.1 bootstrap for a NEW Supabase project. Run once in SQL Editor.
-- Apply as one transaction; existing tables are intentionally not silently replaced.
begin;

create function public.timora_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.timora_touch_updated_at() from public;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 300),
  description text not null default '',
  status text not null default 'active' check (status in ('active','paused','completed')),
  color text not null default '#6b77dc' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300), description text not null default '',
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  start_date date, due_date date, project_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (start_date is null or due_date is null or start_date <= due_date),
  foreign key (project_id, user_id) references public.projects(id, user_id) on delete set null (project_id)
);
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  content text not null default '' check (length(content) <= 1000000), project_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects(id, user_id) on delete set null (project_id)
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300), description text not null default '',
  start_at timestamptz not null, end_at timestamptz not null, project_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_at > start_at),
  foreign key (project_id, user_id) references public.projects(id, user_id) on delete set null (project_id)
);
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  url text not null check (url ~* '^https?://[^[:space:]]+$'),
  type text not null default 'website' check (type in ('website','article','github','video','pdf','file','other')),
  description text not null default '', project_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects(id, user_id) on delete set null (project_id)
);
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null check (length(btrim(content)) between 1 and 20000),
  type text not null default 'unclassified' check (type in ('unclassified','task','note','event','project','resource')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workspace_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  workspace_name text not null default 'My Workspace' check (length(btrim(workspace_name)) between 1 and 80),
  appearance text not null default 'system' check (appearance in ('light','dark','system')),
  updated_at timestamptz not null default now()
);

-- Ownership policies include SELECT for UPDATE, USING and WITH CHECK.
do $$
declare table_name text;
begin
  foreach table_name in array array['projects','tasks','notes','events','library_items','inbox_items','workspace_settings'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.timora_touch_updated_at()', table_name);
    if table_name <> 'workspace_settings' then
      execute format('create index on public.%I (user_id, updated_at desc)', table_name);
    end if;
  end loop;
end;
$$;
create index on public.tasks (user_id, due_date);
create index on public.tasks (user_id, start_date);
create index on public.tasks (user_id, project_id);
create index on public.notes (user_id, project_id);
create index on public.events (user_id, start_at, end_at);
create index on public.events (user_id, project_id);
create index on public.library_items (user_id, project_id);

-- SECURITY INVOKER: caller's RLS applies to the source AND the destination.
-- Locking + transaction prevents duplicate conversion from retries or two tabs.
create function public.convert_inbox(item_id uuid, target_kind text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare item public.inbox_items%rowtype; new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if target_kind not in ('task','note') then raise exception 'Unsupported conversion'; end if;
  select * into item from public.inbox_items where id = item_id and user_id = auth.uid() for update;
  if not found then raise exception 'Inbox item not found or already converted'; end if;
  if target_kind = 'task' then
    insert into public.tasks(user_id, title, description) values (auth.uid(), left(split_part(item.content, E'\n', 1), 300), item.content) returning id into new_id;
  else
    insert into public.notes(user_id, title, content) values (auth.uid(), left(split_part(item.content, E'\n', 1), 300), item.content) returning id into new_id;
  end if;
  delete from public.inbox_items where id = item_id;
  return new_id;
end;
$$;
revoke all on function public.convert_inbox(uuid, text) from public, anon;
grant execute on function public.convert_inbox(uuid, text) to authenticated;
commit;
