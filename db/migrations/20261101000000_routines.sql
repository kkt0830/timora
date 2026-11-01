begin;
set local lock_timeout='5s';
create table public.routines(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 title text not null check(char_length(btrim(title)) between 1 and 300),description text not null check(char_length(description)<=20000),
 frequency text not null check(frequency in ('daily','weekdays','weekly','monthly','yearly')),
 interval_days integer not null check(interval_days between 1 and 366),start_date date not null,end_date date,
 occurrence_limit integer check(occurrence_limit between 1 and 10000),weekdays text not null check(weekdays='' or weekdays ~ '^[0-6](,[0-6])*$'),
 timezone text not null check(char_length(timezone) between 1 and 64),status text not null check(status in ('active','paused','archived')),
 reminder_time text check(reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),category text not null check(char_length(category)<=100),
 unique(id,user_id),check(end_date is null or end_date>=start_date)
);
create table public.routine_completions(
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),routine_id uuid not null,local_date date not null,status text not null check(status in ('todo','done')),
 unique(routine_id,local_date),foreign key(routine_id,user_id) references public.routines(id,user_id) on delete restrict,
 check(id=substring(encode(sha256(convert_to(routine_id::text||':'||local_date::text,'UTF8')),'hex'),1,32)::uuid)
);
create index routine_completions_parent on public.routine_completions(routine_id,user_id,local_date);
create index routines_owner_updated on public.routines(user_id,updated_at,id);
alter table public.routines enable row level security;
create policy owner_access on public.routines to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.routines from public,anon,authenticated;
grant select,insert,update,delete on public.routines to authenticated;
create trigger touch_updated_at before update on public.routines for each row execute function public.timora_touch_updated_at();
create trigger capture_sync after insert or update or delete on public.routines for each row execute function timora_private.capture_sync();
create index routine_completions_owner_updated on public.routine_completions(user_id,updated_at,id);
alter table public.routine_completions enable row level security;
create policy owner_access on public.routine_completions to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.routine_completions from public,anon,authenticated;
grant select,insert,update,delete on public.routine_completions to authenticated;
create trigger touch_updated_at before update on public.routine_completions for each row execute function public.timora_touch_updated_at();
create trigger capture_sync after insert or update or delete on public.routine_completions for each row execute function timora_private.capture_sync();
alter table public.sync_records drop constraint sync_records_entity_table_check;
alter table public.sync_records add constraint sync_records_entity_table_check check(entity_table in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions'));
create or replace function public.sync_pull_v2(after_revision text default '0', batch_size integer default 200) returns jsonb
language sql security invoker set search_path='' as $$
with page as materialized(
 select * from public.sync_records where user_id=auth.uid() and entity_table not in ('routines','routine_completions') and revision>after_revision::bigint
 order by revision limit greatest(1,least(batch_size,200))
), records as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) order by revision),'[]'::jsonb) data, max(revision) last_revision from page
), parent_tasks as (
 select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='tasks'
 and r.id in(select (payload->>'task_id')::uuid from page where entity_table='subtasks' and payload->>'task_id' is not null)
), parents as (
 select * from parent_tasks
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='projects'
 and r.id in(select (payload->>'project_id')::uuid from page where payload->>'project_id' is not null
 union select (payload->>'project_id')::uuid from parent_tasks where payload->>'project_id' is not null)
), dependencies as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) order by case entity_table when 'projects' then 0 else 1 end,revision),'[]'::jsonb) data from parents
)
select jsonb_build_object('records',records.data,'dependencies',dependencies.data,'cursor',coalesce(records.last_revision::text,after_revision),'has_more',(select count(*)>=greatest(1,least(batch_size,200)) from page)) from records,dependencies;
$$;
revoke all on function public.sync_pull_v2(text,integer) from public,anon;
grant execute on function public.sync_pull_v2(text,integer) to authenticated;

create function public.sync_pull_v3(after_revision text default '0', batch_size integer default 200) returns jsonb
language sql security invoker set search_path='' as $$
with page as materialized(
 select * from public.sync_records where user_id=auth.uid() and revision>after_revision::bigint
 order by revision limit greatest(1,least(batch_size,200))
), records as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) order by revision),'[]'::jsonb) data, max(revision) last_revision from page
), parent_tasks as (
 select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='tasks'
 and r.id in(select (payload->>'task_id')::uuid from page where entity_table='subtasks' and payload->>'task_id' is not null)
), parents as (
 select * from parent_tasks
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='routines' and r.id in(select (payload->>'routine_id')::uuid from page where entity_table='routine_completions' and payload->>'routine_id' is not null)
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='projects'
 and r.id in(select (payload->>'project_id')::uuid from page where payload->>'project_id' is not null
 union select (payload->>'project_id')::uuid from parent_tasks where payload->>'project_id' is not null)
), dependencies as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) order by case entity_table when 'projects' then 0 else 1 end,revision),'[]'::jsonb) data from parents
)
select jsonb_build_object('records',records.data,'dependencies',dependencies.data,'cursor',coalesce(records.last_revision::text,after_revision),'has_more',(select count(*)>=greatest(1,least(batch_size,200)) from page)) from records,dependencies;
$$;
revoke all on function public.sync_pull_v3(text,integer) from public,anon;
grant execute on function public.sync_pull_v3(text,integer) to authenticated;

create function public.sync_apply_v3(operation_id uuid,entity_table text,entity_id text,action text,payload jsonb default null,base_revision text default null,base_updated_at text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 owner_id uuid=auth.uid(); item_id uuid; stored jsonb; previous public.sync_records%rowtype;
 receipt public.sync_receipts%rowtype; request_hash text; result jsonb; record jsonb;
 columns text[]; assignments text; column_list text; source_list text; equal_content boolean=false;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if entity_table not in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions') or action not in ('put','delete') then raise exception 'Unsupported sync operation' using errcode='22023'; end if;
 if entity_table='workspace_settings' and (entity_id<>'settings' or action<>'put') then raise exception 'Invalid settings operation' using errcode='22023'; end if;
 item_id=case when entity_table='workspace_settings' then owner_id else entity_id::uuid end;
 request_hash=md5(jsonb_build_object('table',entity_table,'id',entity_id,'action',action,'payload',payload,'base_revision',base_revision,'base_updated_at',base_updated_at)::text);
 -- Serialize duplicate deliveries before the mutation. Lost responses can be retried safely.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||operation_id::text,0));
 select * into receipt from public.sync_receipts r where r.user_id=owner_id and r.operation_id=sync_apply_v3.operation_id;
 if found then
  if receipt.request_hash<>request_hash then raise exception 'Operation ID reused with different content' using errcode='22023'; end if;
  return receipt.response;
 end if;
 -- Lock the business row first, matching ordinary Web CRUD lock order.
 execute format('select to_jsonb(r) from public.%I r where %I=$1 and user_id=$2 for update',entity_table,case when entity_table='workspace_settings' then 'user_id' else 'id' end) into stored using item_id,owner_id;
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v3.entity_table and r.id=item_id;
 columns=case entity_table
  when 'routines' then array['title','description','frequency','interval_days','start_date','end_date','occurrence_limit','weekdays','timezone','status','reminder_time','category']
  when 'routine_completions' then array['routine_id','local_date','status']
  when 'subtasks' then array['task_id','title','status','position']
  when 'projects' then array['name','description','status','color']
  when 'tasks' then array['title','description','status','priority','start_date','due_date','project_id']
  when 'notes' then array['title','content','project_id']
  when 'events' then array['title','description','start_at','end_at','project_id']
  when 'library_items' then array['title','description','url','type','project_id']
  when 'inbox_items' then array['content','type']
  else array['workspace_name','appearance','display_name','avatar_url'] end;
 if action='put' and stored is not null then
  select bool_and(stored->c is not distinct from payload->c) into equal_content from unnest(columns)c;
 end if;
 if not equal_content and not (action='delete' and stored is null) and (
  (base_revision is not null and coalesce(previous.revision,0)<>base_revision::bigint)
  or (base_revision is null and base_updated_at is not null and (stored is null or (stored->>'updated_at')::timestamptz<>base_updated_at::timestamptz))
  or (base_revision is null and base_updated_at is null and previous.revision is not null)
 ) then
  record=jsonb_build_object('user_id',owner_id,'entity_table',entity_table,'id',item_id,'revision',coalesce(previous.revision,0)::text,'deleted',coalesce(previous.deleted,true),'payload',previous.payload);
  return jsonb_build_object('status','conflict','record',record);
 end if;
 if action='delete' then
  -- A missing row is an idempotent deletion, including a create/delete race on a new local row.
  execute format('delete from public.%I where id=$1 and user_id=$2',entity_table) using item_id,owner_id;
 elsif not equal_content then
  if jsonb_typeof(payload)<>'object' then raise exception 'Invalid sync payload' using errcode='22023'; end if;
  payload=payload||jsonb_build_object('id',item_id,'user_id',owner_id);
  select string_agg(format('%I=x.%I',c,c),','),string_agg(format('%I',c),','),string_agg(format('x.%I',c),',') into assignments,column_list,source_list from unnest(columns)c;
  if stored is not null then
   execute format('update public.%I r set %s from jsonb_populate_record(null::public.%I,$1)x where r.%I=$2 and r.user_id=$3',entity_table,assignments,entity_table,case when entity_table='workspace_settings' then 'user_id' else 'id' end) using payload,item_id,owner_id;
  elsif entity_table='workspace_settings' then
   execute format('insert into public.workspace_settings(user_id,%s) select $2,%s from jsonb_populate_record(null::public.workspace_settings,$1)x',column_list,source_list) using payload,owner_id;
  else
   execute format('insert into public.%I(id,user_id,created_at,%s) select $2,$3,coalesce(x.created_at,now()),%s from jsonb_populate_record(null::public.%I,$1)x',entity_table,column_list,source_list,entity_table) using payload,item_id,owner_id;
  end if;
 end if;
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v3.entity_table and r.id=item_id;
 record=jsonb_build_object('user_id',owner_id,'entity_table',entity_table,'id',item_id,'revision',coalesce(previous.revision,0)::text,'deleted',coalesce(previous.deleted,true),'payload',previous.payload);
 result=jsonb_build_object('status','applied','record',record);
 insert into public.sync_receipts values(owner_id,operation_id,request_hash,result);
 return result;
end;
$$;
revoke all on function public.sync_apply_v3(uuid,text,text,text,jsonb,text,text) from public,anon;
grant execute on function public.sync_apply_v3(uuid,text,text,text,jsonb,text,text) to authenticated;
create function public.sync_capabilities_v3() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('protocol',3,'entities',jsonb_build_array('subtasks','routines','routine_completions')) where auth.uid() is not null;
$$;
revoke all on function public.sync_capabilities_v3() from public,anon;
grant execute on function public.sync_capabilities_v3() to authenticated;
commit;
