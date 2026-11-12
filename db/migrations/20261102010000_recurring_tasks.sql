begin;
set local lock_timeout='5s';
create table public.task_recurrences(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 title text not null check(char_length(btrim(title)) between 1 and 300),description text not null check(char_length(description)<=20000),
 frequency text not null check(frequency in ('daily','weekdays','weekly','monthly','yearly')),
 interval_days integer not null check(interval_days between 1 and 366),start_date date not null,end_date date,
 occurrence_limit integer check(occurrence_limit between 1 and 10000),weekdays text not null check(weekdays='' or weekdays ~ '^[0-6](,[0-6])*$'),
 timezone text not null check(char_length(timezone) between 1 and 64),status text not null check(status in ('active','paused','archived')),
 reminder_time text check(reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),category text not null check(char_length(category)<=100),priority text not null check(priority in ('low','medium','high')),project_id uuid,foreign key(project_id,user_id) references public.projects(id,user_id) on delete set null (project_id),
 unique(id,user_id),check(end_date is null or end_date>=start_date)
);
create table public.task_occurrences(
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),recurrence_id uuid not null,local_date date not null,task_id uuid not null,foreign key(task_id,user_id) references public.tasks(id,user_id) on delete restrict,
 check(id=task_id),unique(recurrence_id,local_date),foreign key(recurrence_id,user_id) references public.task_recurrences(id,user_id) on delete restrict,
 check(id=substring(encode(sha256(convert_to(recurrence_id::text||':'||local_date::text,'UTF8')),'hex'),1,32)::uuid)
);
create index task_occurrences_parent on public.task_occurrences(recurrence_id,user_id,local_date);
create index task_recurrences_owner_updated on public.task_recurrences(user_id,updated_at,id);
alter table public.task_recurrences enable row level security;
create policy owner_access on public.task_recurrences to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.task_recurrences from public,anon,authenticated;
grant select,insert,update,delete on public.task_recurrences to authenticated;
create trigger touch_updated_at before update on public.task_recurrences for each row execute function public.timora_touch_updated_at();
create trigger capture_sync after insert or update or delete on public.task_recurrences for each row execute function timora_private.capture_sync();
create index task_occurrences_owner_updated on public.task_occurrences(user_id,updated_at,id);
alter table public.task_occurrences enable row level security;
create policy owner_access on public.task_occurrences to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.task_occurrences from public,anon,authenticated;
grant select,insert,update,delete on public.task_occurrences to authenticated;
create trigger touch_updated_at before update on public.task_occurrences for each row execute function public.timora_touch_updated_at();
create trigger capture_sync after insert or update or delete on public.task_occurrences for each row execute function timora_private.capture_sync();
ALTER TABLE public.sync_records DROP CONSTRAINT sync_records_entity_table_check;
ALTER TABLE public.sync_records ADD CONSTRAINT sync_records_entity_table_check CHECK(entity_table IN ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences'));
create or replace function public.sync_pull_v4(after_revision text default '0', batch_size integer default 200) returns jsonb
language sql security invoker set search_path='' as $$
with page as materialized(
 select * from public.sync_records where user_id=auth.uid() and entity_table in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions') and revision>after_revision::bigint
 order by revision limit greatest(1,least(batch_size,200))
), records as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) order by revision),'[]'::jsonb) data, max(revision) last_revision from page
), parent_tasks as (
 select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='tasks'
 and r.id in(select (payload->>'task_id')::uuid from page where entity_table in ('subtasks','task_blocks','board_positions') and payload->>'task_id' is not null)
), parents as (
 select * from parent_tasks
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='notes' and r.id in(select (payload->>'note_id')::uuid from page where entity_table='note_tags')
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='tags' and r.id in(select (payload->>'tag_id')::uuid from page where entity_table='note_tags')
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='routines' and r.id in(select (payload->>'routine_id')::uuid from page where entity_table='routine_completions' and payload->>'routine_id' is not null)
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='projects'
 and r.id in(select (payload->>'project_id')::uuid from page where payload->>'project_id' is not null
 union select (payload->>'project_id')::uuid from parent_tasks where payload->>'project_id' is not null
 union select (r.payload->>'project_id')::uuid from public.sync_records r where r.user_id=auth.uid() and r.entity_table='notes' and r.id in(select (payload->>'note_id')::uuid from page where entity_table='note_tags') and r.payload->>'project_id' is not null)
), dependencies as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) order by case entity_table when 'projects' then 0 else 1 end,revision),'[]'::jsonb) data from parents
)
select jsonb_build_object('records',records.data,'dependencies',dependencies.data,'cursor',coalesce(records.last_revision::text,after_revision),'has_more',(select count(*)>=greatest(1,least(batch_size,200)) from page)) from records,dependencies;
$$;
revoke all on function public.sync_pull_v4(text,integer) from public,anon;
grant execute on function public.sync_pull_v4(text,integer) to authenticated;


create function public.sync_pull_v5(after_revision text default '0', batch_size integer default 200) returns jsonb
language sql security invoker set search_path='' as $$
with page as materialized(
 select * from public.sync_records where user_id=auth.uid() and revision>after_revision::bigint
 order by revision limit greatest(1,least(batch_size,200))
), records as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) order by revision),'[]'::jsonb) data, max(revision) last_revision from page
), parent_tasks as (
 select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='tasks'
 and r.id in(select (payload->>'task_id')::uuid from page where entity_table in ('subtasks','task_blocks','board_positions','task_occurrences') and payload->>'task_id' is not null)
), parents as (
 select * from parent_tasks
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='task_recurrences' and r.id in(select (payload->>'recurrence_id')::uuid from page where entity_table='task_occurrences')
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='notes' and r.id in(select (payload->>'note_id')::uuid from page where entity_table='note_tags')
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='tags' and r.id in(select (payload->>'tag_id')::uuid from page where entity_table='note_tags')
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='routines' and r.id in(select (payload->>'routine_id')::uuid from page where entity_table='routine_completions' and payload->>'routine_id' is not null)
 union all select r.* from public.sync_records r where r.user_id=auth.uid() and r.entity_table='projects'
 and r.id in(select (payload->>'project_id')::uuid from page where payload->>'project_id' is not null
 union select (payload->>'project_id')::uuid from parent_tasks where payload->>'project_id' is not null
 union select (r.payload->>'project_id')::uuid from public.sync_records r where r.user_id=auth.uid() and r.entity_table='notes' and r.id in(select (payload->>'note_id')::uuid from page where entity_table='note_tags') and r.payload->>'project_id' is not null
 union select (r.payload->>'project_id')::uuid from public.sync_records r where r.user_id=auth.uid() and r.entity_table='task_recurrences' and r.id in(select (payload->>'recurrence_id')::uuid from page where entity_table='task_occurrences') and r.payload->>'project_id' is not null)
), dependencies as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) order by case entity_table when 'projects' then 0 else 1 end,revision),'[]'::jsonb) data from parents
)
select jsonb_build_object('records',records.data,'dependencies',dependencies.data,'cursor',coalesce(records.last_revision::text,after_revision),'has_more',(select count(*)>=greatest(1,least(batch_size,200)) from page)) from records,dependencies;
$$;
revoke all on function public.sync_pull_v5(text,integer) from public,anon;
grant execute on function public.sync_pull_v5(text,integer) to authenticated;


create function public.sync_apply_v5(operation_id uuid,entity_table text,entity_id text,action text,payload jsonb default null,base_revision text default null,base_updated_at text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 owner_id uuid=auth.uid(); item_id uuid; stored jsonb; previous public.sync_records%rowtype;
 receipt public.sync_receipts%rowtype; request_hash text; result jsonb; record jsonb;
 columns text[]; assignments text; column_list text; source_list text; equal_content boolean=false;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if entity_table not in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences') or action not in ('put','delete') then raise exception 'Unsupported sync operation' using errcode='22023'; end if;
 if entity_table='workspace_settings' and (entity_id<>'settings' or action<>'put') then raise exception 'Invalid settings operation' using errcode='22023'; end if;
 item_id=case when entity_table='workspace_settings' then owner_id else entity_id::uuid end;
 request_hash=md5(jsonb_build_object('table',entity_table,'id',entity_id,'action',action,'payload',payload,'base_revision',base_revision,'base_updated_at',base_updated_at)::text);
 -- Serialize duplicate deliveries before the mutation. Lost responses can be retried safely.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||operation_id::text,0));
 -- Distinct devices may create the same deterministic occurrence simultaneously.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||entity_table||item_id::text,1));
 select * into receipt from public.sync_receipts r where r.user_id=owner_id and r.operation_id=sync_apply_v5.operation_id;
 if found then
  if receipt.request_hash<>request_hash then raise exception 'Operation ID reused with different content' using errcode='22023'; end if;
  return receipt.response;
 end if;
 -- Lock the business row first, matching ordinary Web CRUD lock order.
 execute format('select to_jsonb(r) from public.%I r where %I=$1 and user_id=$2 for update',entity_table,case when entity_table='workspace_settings' then 'user_id' else 'id' end) into stored using item_id,owner_id;
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v5.entity_table and r.id=item_id;
 columns=case entity_table
 when 'task_recurrences' then array['title','description','frequency','interval_days','start_date','end_date','occurrence_limit','weekdays','timezone','status','reminder_time','category','priority','project_id']
 when 'task_occurrences' then array['recurrence_id','local_date','task_id']
  when 'tags' then array['name','color']
  when 'note_tags' then array['note_id','tag_id']
  when 'note_templates' then array['title','content']
  when 'task_blocks' then array['task_id','start_at','end_at']
  when 'board_positions' then array['task_id','position']

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
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v5.entity_table and r.id=item_id;
 record=jsonb_build_object('user_id',owner_id,'entity_table',entity_table,'id',item_id,'revision',coalesce(previous.revision,0)::text,'deleted',coalesce(previous.deleted,true),'payload',previous.payload);
 result=jsonb_build_object('status','applied','record',record);
 insert into public.sync_receipts values(owner_id,operation_id,request_hash,result);
 return result;
end;
$$;
revoke all on function public.sync_apply_v5(uuid,text,text,text,jsonb,text,text) from public,anon;
grant execute on function public.sync_apply_v5(uuid,text,text,text,jsonb,text,text) to authenticated;

CREATE FUNCTION public.sync_capabilities_v5() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_object('protocol',5,'entities',jsonb_build_array('subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences')) WHERE auth.uid() IS NOT NULL; $$;
REVOKE ALL ON FUNCTION public.sync_capabilities_v5() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.sync_capabilities_v5() TO authenticated;
CREATE FUNCTION public.generate_recurring_tasks(rule_id uuid, expected_updated_at timestamptz, requested_days date[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE owner_id uuid=auth.uid(); rule public.task_recurrences%rowtype; days date[]; allowed date[]; day date; item_id uuid;
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 SELECT * INTO rule FROM public.task_recurrences WHERE id=rule_id AND user_id=owner_id FOR UPDATE;
 IF NOT FOUND OR rule.status<>'active' OR rule.updated_at<>expected_updated_at THEN RAISE EXCEPTION 'Rule changed; reload' USING errcode='22023'; END IF;
 IF requested_days IS NULL OR cardinality(requested_days) NOT BETWEEN 1 AND 31 OR array_position(requested_days,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Request 1 to 31 dates' USING errcode='22023'; END IF;
 SELECT array_agg(d ORDER BY d) INTO days FROM (SELECT DISTINCT unnest(requested_days) d) x;
 IF days[1]<rule.start_date OR days[cardinality(days)]-rule.start_date>36600 THEN RAISE EXCEPTION 'Date range unsupported' USING errcode='22023'; END IF;
 WITH dates AS (SELECT rule.start_date+i AS d,i FROM generate_series(0,days[cardinality(days)]-rule.start_date) i), matches AS (
 SELECT d,row_number() OVER(ORDER BY d) n FROM dates WHERE (rule.end_date IS NULL OR d<=rule.end_date) AND CASE rule.frequency
 WHEN 'daily' THEN i%rule.interval_days=0
 WHEN 'weekdays' THEN i%rule.interval_days=0 AND extract(isodow FROM d)<6
 WHEN 'weekly' THEN ((i+extract(isodow FROM rule.start_date)::integer-1)/7)%rule.interval_days=0 AND CASE WHEN rule.weekdays='' THEN extract(dow FROM d)=extract(dow FROM rule.start_date) ELSE extract(dow FROM d)::integer::text=ANY(string_to_array(rule.weekdays,',')) END
 WHEN 'monthly' THEN ((extract(year FROM d)::integer-extract(year FROM rule.start_date)::integer)*12+extract(month FROM d)::integer-extract(month FROM rule.start_date)::integer)%rule.interval_days=0 AND extract(day FROM d)=extract(day FROM rule.start_date)
 WHEN 'yearly' THEN (extract(year FROM d)::integer-extract(year FROM rule.start_date)::integer)%rule.interval_days=0 AND extract(month FROM d)=extract(month FROM rule.start_date) AND extract(day FROM d)=extract(day FROM rule.start_date)
 ELSE false END)
 SELECT array_agg(d ORDER BY d) INTO allowed FROM matches WHERE d=ANY(days) AND (rule.occurrence_limit IS NULL OR n<=rule.occurrence_limit);
 IF allowed IS DISTINCT FROM days THEN RAISE EXCEPTION 'Dates do not match rule' USING errcode='22023'; END IF;
 FOREACH day IN ARRAY days LOOP
  item_id=substring(encode(sha256(convert_to(rule_id::text||':'||day::text,'UTF8')),'hex'),1,32)::uuid;
  IF EXISTS(SELECT 1 FROM public.task_occurrences WHERE id=item_id AND user_id=owner_id) THEN CONTINUE; END IF;
  INSERT INTO public.tasks(id,user_id,title,description,status,priority,start_date,due_date,project_id) VALUES(item_id,owner_id,rule.title,rule.description,'todo',rule.priority,day,day,rule.project_id);
  INSERT INTO public.task_occurrences(id,user_id,recurrence_id,local_date,task_id) VALUES(item_id,owner_id,rule_id,day,item_id);
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.generate_recurring_tasks(uuid,timestamptz,date[]) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.generate_recurring_tasks(uuid,timestamptz,date[]) TO authenticated;
commit;
