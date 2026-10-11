-- Isolated test database ONLY, after all migrations; fixtures always roll back.
begin;
insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
insert into public.notes(id,user_id,title) values ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','B private');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$
declare a jsonb; b jsonb; p jsonb; page jsonb; op uuid=gen_random_uuid(); id uuid=gen_random_uuid(); project uuid=gen_random_uuid(); rev text; n integer;
begin
 p=jsonb_build_object('title','Offline note','content','# keep','project_id',null,'created_at','2026-01-01T00:00:00Z');
 a=public.sync_apply(op,'notes',id::text,'put',p);
 if a->>'status'<>'applied' or a->'record'->'payload'->>'user_id'<>auth.uid()::text then raise exception 'create/owner mismatch'; end if;
 if a->'record'->'payload'->>'created_at'<>'2026-01-01T00:00:00+00:00' then raise exception 'creation timestamp lost'; end if;
 rev=a->'record'->>'revision';
 b=public.sync_apply(op,'notes',id::text,'put',p);
 if a<>b then raise exception 'lost acknowledgement replay changed'; end if;
 begin
  perform public.sync_apply(op,'notes',id::text,'put',p||'{"content":"changed"}');
  raise exception 'operation reuse accepted';
 exception when invalid_parameter_value then null; end;
 -- A different device with stale revision must preserve the first edit.
 a=public.sync_apply(gen_random_uuid(),'notes',id::text,'put',p||'{"content":"device A"}',rev);
 b=public.sync_apply(gen_random_uuid(),'notes',id::text,'put',p||'{"content":"device B"}',rev);
 if b->>'status'<>'conflict' or b->'record'->'payload'->>'content'<>'device A' then raise exception 'stale edit overwrote current data'; end if;
 -- Explicit local choice rebases, then a remote delete is propagated.
 a=public.sync_apply(gen_random_uuid(),'notes',id::text,'put',p||'{"content":"chosen B"}',b->'record'->>'revision');
 a=public.sync_apply(gen_random_uuid(),'notes',id::text,'delete',null,a->'record'->>'revision');
 if a->'record'->>'deleted'<>'true' then raise exception 'delete missing tombstone'; end if;
 b=public.sync_apply(gen_random_uuid(),'notes',id::text,'delete',null,rev);
 if b->>'status'<>'applied' then raise exception 'already deleted row produced conflict'; end if;
 page=public.sync_pull('0',1);
 if jsonb_array_length(page->'records')<>1 or page->>'has_more'<>'true' then raise exception 'pagination failure'; end if;
 page=public.sync_pull(page->>'cursor',200);
 if exists(select 1 from jsonb_array_elements(page->'records') r where r->>'user_id'<>auth.uid()::text) then raise exception 'other owner feed visible'; end if;
 if exists(select 1 from public.sync_records where user_id<>auth.uid()) then raise exception 'RLS failed'; end if;
 if exists(select 1 from public.sync_receipts where user_id<>auth.uid()) then raise exception 'receipt RLS failed'; end if;
 begin
  insert into public.sync_records(user_id,entity_table,id,revision,deleted) values(auth.uid(),'notes',gen_random_uuid(),999,true);
  raise exception 'feed tampering allowed';
 exception when insufficient_privilege then null; end;
 -- Forged incoming owner cannot select or mutate B's UUID.
 begin
  perform public.sync_apply(gen_random_uuid(),'notes','30000000-0000-0000-0000-000000000002','put',p||jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'));
  raise exception 'other account UUID changed';
 exception when unique_violation then null; end;
 -- Ordinary Web writes and project detachment also enter the feed.
 insert into public.projects(id,name) values(project,'Project');
 insert into public.tasks(title,project_id) values('Linked task',project);
 page=public.sync_pull('0',200);
 if not exists(select 1 from jsonb_array_elements(page->'dependencies') r where r->>'id'=project::text) then raise exception 'missing project dependency'; end if;
 delete from public.projects where public.projects.id=project;
 select count(*) into n from public.sync_records where entity_table='tasks' and payload->>'title'='Linked task' and payload->>'project_id' is null;
 if n<>1 then raise exception 'FK detachment not captured'; end if;
 -- Settings use the authenticated owner ID rather than the local singleton key.
 a=public.sync_apply(gen_random_uuid(),'workspace_settings','settings','put','{"workspace_name":"Mine","appearance":"dark","display_name":"Name","avatar_url":null}');
 if a->'record'->>'id'<>auth.uid()::text then raise exception 'settings ID mismatch'; end if;
end;
$$;
set local role anon;
do $$ begin
 begin perform public.sync_pull('0',200); raise exception 'anon sync read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.sync_apply(gen_random_uuid(),'notes',gen_random_uuid()::text,'delete'); raise exception 'anon sync write allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role postgres;
select set_config('request.jwt.claim.sub','',true);
delete from auth.users where id='10000000-0000-0000-0000-000000000002';
rollback;
