-- Run as postgres after db/schema.sql, on an isolated test database.
-- Uses the real Postgres RLS engine; all fixture rows are rolled back.
begin;
insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
insert into public.projects(id,user_id,name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A'), ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','B');
insert into public.notes(id,user_id,title) values ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','B-private');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$
declare count_rows int; inbox_id uuid; object_id uuid; table_name text;
begin
  select count(*) into count_rows from public.projects;
  if count_rows <> 1 then raise exception 'Other user projects visible'; end if;
  select count(*) into count_rows from public.notes;
  if count_rows <> 0 then raise exception 'Other user notes visible'; end if;
  update public.notes set title = 'stolen' where id = '30000000-0000-0000-0000-000000000002';
  get diagnostics count_rows = row_count;
  if count_rows <> 0 then raise exception 'Other user notes writable'; end if;
  delete from public.projects where id = '20000000-0000-0000-0000-000000000002';
  get diagnostics count_rows = row_count;
  if count_rows <> 0 then raise exception 'Other user projects deletable'; end if;
  begin
    insert into public.notes(user_id,title) values ('10000000-0000-0000-0000-000000000002','forged');
    raise exception 'Forged ownership was accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.projects set user_id = '10000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001';
    raise exception 'Ownership reassignment was accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.tasks(title,project_id) values ('forged project','20000000-0000-0000-0000-000000000002');
    raise exception 'Cross-user project link was accepted';
  exception when foreign_key_violation then null; end;
  insert into public.tasks(title,project_id) values ('own task','20000000-0000-0000-0000-000000000001');
  insert into public.notes(title,content,project_id) values ('own note','# Markdown','20000000-0000-0000-0000-000000000001');
  insert into public.events(title,start_at,end_at,project_id) values ('own event',now(),now()+interval '1 hour','20000000-0000-0000-0000-000000000001');
  insert into public.library_items(title,url,project_id) values ('own URL','https://example.com','20000000-0000-0000-0000-000000000001');
  insert into public.workspace_settings(workspace_name) values ('A workspace');
  insert into public.inbox_items(content) values ('Move once') returning id into inbox_id;
  object_id = public.convert_inbox(inbox_id,'task');
  if not exists(select from public.tasks where id = object_id) then raise exception 'Conversion missing'; end if;
  if exists(select from public.inbox_items where id = inbox_id) then raise exception 'Conversion left source'; end if;
  begin
    perform public.convert_inbox(inbox_id,'task');
    raise exception 'Duplicate conversion accepted';
  exception when raise_exception then
    if sqlerrm = 'Duplicate conversion accepted' then raise; end if;
  end;
  insert into public.inbox_items(content) values ('Rollback me') returning id into inbox_id;
  begin perform public.convert_inbox(inbox_id,'event'); exception when raise_exception then null; end;
  if not exists(select from public.inbox_items where id = inbox_id) then raise exception 'Failed conversion destroyed source'; end if;
  delete from public.projects where id = '20000000-0000-0000-0000-000000000001';
  foreach table_name in array array['tasks','notes','events','library_items'] loop
    execute format('select count(*) from public.%I where project_id is not null',table_name) into count_rows;
    if count_rows <> 0 then raise exception 'Project delete failed to clear links'; end if;
  end loop;
end;
$$;
-- B cannot see A's rows in any entity or settings table.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$
declare table_name text; count_rows int;
begin
  foreach table_name in array array['tasks','notes','events','library_items','inbox_items','workspace_settings'] loop
    execute format('select count(*) from public.%I where user_id = %L',table_name,'10000000-0000-0000-0000-000000000001') into count_rows;
    if count_rows <> 0 then raise exception 'Cross-user read in %',table_name; end if;
    execute format('update public.%I set user_id = user_id where user_id = %L',table_name,'10000000-0000-0000-0000-000000000001');
    get diagnostics count_rows = row_count;
    if count_rows <> 0 then raise exception 'Cross-user update in %',table_name; end if;
  end loop;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin perform * from public.tasks; raise exception 'Anonymous read accepted';
  exception when insufficient_privilege then null; end;
  begin perform public.convert_inbox(gen_random_uuid(),'task'); raise exception 'Anonymous RPC accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
