-- Disposable transaction only; exercise real RLS and both protocol generations.
begin;
insert into auth.users(id) values('f0000000-0000-4000-8000-000000000001'),('f0000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
insert into public.tasks(id,user_id,title) values('f0000000-0000-4000-8000-000000000010',auth.uid(),'parent');
insert into public.subtasks(id,user_id,task_id,title,position) values('f0000000-0000-4000-8000-000000000011',auth.uid(),'f0000000-0000-4000-8000-000000000010','first',0),('f0000000-0000-4000-8000-000000000012',auth.uid(),'f0000000-0000-4000-8000-000000000010','second',1);
select public.reorder_subtasks('f0000000-0000-4000-8000-000000000010',array['f0000000-0000-4000-8000-000000000012','f0000000-0000-4000-8000-000000000011']::uuid[]);
do $$ begin
 if (select position from public.subtasks where id='f0000000-0000-4000-8000-000000000012')<>0 then raise exception 'order not persisted'; end if;
 begin perform public.reorder_subtasks('f0000000-0000-4000-8000-000000000010',array['f0000000-0000-4000-8000-000000000012']::uuid[]); raise exception 'partial reorder accepted'; exception when invalid_parameter_value then null; end;
 if exists(select 1 from jsonb_array_elements(public.sync_pull('0',200)->'records') r where r->>'entity_table'='subtasks') then raise exception 'v1 exposed unknown entities'; end if;
 if not exists(select 1 from jsonb_array_elements(public.sync_pull_v2('0',200)->'records') r where r->>'entity_table'='subtasks') then raise exception 'v2 missed subtasks'; end if;
end $$;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.subtasks) then raise exception 'owner leak'; end if;
 begin insert into public.subtasks(user_id,task_id,title,position) values(auth.uid(),'f0000000-0000-4000-8000-000000000010','attack',0); raise exception 'foreign parent accepted'; exception when foreign_key_violation then null; end;
 begin insert into public.subtasks(user_id,task_id,title,position) values('f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000010','attack',0); raise exception 'foreign owner accepted'; exception when insufficient_privilege then null; end;
 begin perform public.reorder_subtasks('f0000000-0000-4000-8000-000000000010',array[]::uuid[]); raise exception 'foreign reorder accepted'; exception when insufficient_privilege then null; end;
 if jsonb_array_length(public.sync_pull_v2('0',200)->'records')<>0 then raise exception 'feed leak'; end if;
end $$;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
delete from public.tasks where id='f0000000-0000-4000-8000-000000000010';
do $$ begin
 if exists(select 1 from public.subtasks) then raise exception 'orphan'; end if;
 if (select count(*) from public.sync_records where entity_table='subtasks' and deleted)<>2 then raise exception 'missing deletion propagation'; end if;
end $$;
rollback;
