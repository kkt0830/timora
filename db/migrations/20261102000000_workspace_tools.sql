begin;
set local lock_timeout='5s';
CREATE UNIQUE INDEX IF NOT EXISTS notes_id_owner ON public.notes(id,user_id);
CREATE TABLE public.tags(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 80),color text NOT NULL CHECK(char_length(color)=7),UNIQUE(id,user_id));
CREATE INDEX tags_owner_updated ON public.tags(user_id,updated_at,id);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON public.tags TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
REVOKE ALL ON public.tags FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tags TO authenticated;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.timora_touch_updated_at();
CREATE TRIGGER capture_sync AFTER INSERT OR UPDATE OR DELETE ON public.tags FOR EACH ROW EXECUTE FUNCTION timora_private.capture_sync();
CREATE TABLE public.note_tags(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),note_id uuid NOT NULL,tag_id uuid NOT NULL,UNIQUE(note_id,tag_id),FOREIGN KEY(note_id,user_id) REFERENCES public.notes(id,user_id) ON DELETE CASCADE,FOREIGN KEY(tag_id,user_id) REFERENCES public.tags(id,user_id) ON DELETE CASCADE);
ALTER TABLE public.note_tags ADD CHECK(id=substring(encode(sha256(convert_to(note_id::text||':'||tag_id::text,'UTF8')),'hex'),1,32)::uuid);
CREATE INDEX note_tags_note_id ON public.note_tags(note_id,user_id);
CREATE INDEX note_tags_tag_id ON public.note_tags(tag_id,user_id);
CREATE INDEX note_tags_owner_updated ON public.note_tags(user_id,updated_at,id);
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON public.note_tags TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
REVOKE ALL ON public.note_tags FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.note_tags TO authenticated;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.note_tags FOR EACH ROW EXECUTE FUNCTION public.timora_touch_updated_at();
CREATE TRIGGER capture_sync AFTER INSERT OR UPDATE OR DELETE ON public.note_tags FOR EACH ROW EXECUTE FUNCTION timora_private.capture_sync();
CREATE TABLE public.note_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 300),content text NOT NULL CHECK(char_length(content)<=1000000));
CREATE INDEX note_templates_owner_updated ON public.note_templates(user_id,updated_at,id);
ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON public.note_templates TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
REVOKE ALL ON public.note_templates FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.note_templates TO authenticated;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.note_templates FOR EACH ROW EXECUTE FUNCTION public.timora_touch_updated_at();
CREATE TRIGGER capture_sync AFTER INSERT OR UPDATE OR DELETE ON public.note_templates FOR EACH ROW EXECUTE FUNCTION timora_private.capture_sync();
CREATE TABLE public.task_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),task_id uuid NOT NULL,start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,FOREIGN KEY(task_id,user_id) REFERENCES public.tasks(id,user_id) ON DELETE CASCADE,CHECK(end_at>start_at));
CREATE INDEX task_blocks_task_id ON public.task_blocks(task_id,user_id);
CREATE INDEX task_blocks_owner_updated ON public.task_blocks(user_id,updated_at,id);
ALTER TABLE public.task_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON public.task_blocks TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
REVOKE ALL ON public.task_blocks FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.task_blocks TO authenticated;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.task_blocks FOR EACH ROW EXECUTE FUNCTION public.timora_touch_updated_at();
CREATE TRIGGER capture_sync AFTER INSERT OR UPDATE OR DELETE ON public.task_blocks FOR EACH ROW EXECUTE FUNCTION timora_private.capture_sync();
CREATE TABLE public.board_positions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),task_id uuid NOT NULL UNIQUE,position integer NOT NULL CHECK(position BETWEEN 0 AND 2147483647),FOREIGN KEY(task_id,user_id) REFERENCES public.tasks(id,user_id) ON DELETE CASCADE,CHECK(id=task_id));
CREATE INDEX board_positions_task_id ON public.board_positions(task_id,user_id);
CREATE INDEX board_positions_owner_updated ON public.board_positions(user_id,updated_at,id);
ALTER TABLE public.board_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON public.board_positions TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
REVOKE ALL ON public.board_positions FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.board_positions TO authenticated;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.board_positions FOR EACH ROW EXECUTE FUNCTION public.timora_touch_updated_at();
CREATE TRIGGER capture_sync AFTER INSERT OR UPDATE OR DELETE ON public.board_positions FOR EACH ROW EXECUTE FUNCTION timora_private.capture_sync();
ALTER TABLE public.sync_records DROP CONSTRAINT sync_records_entity_table_check;
ALTER TABLE public.sync_records ADD CONSTRAINT sync_records_entity_table_check CHECK(entity_table IN ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions'));
create or replace function public.sync_pull_v2(after_revision text default '0', batch_size integer default 200) returns jsonb
language sql security invoker set search_path='' as $$
with page as materialized(
 select * from public.sync_records where user_id=auth.uid() and entity_table in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks') and revision>after_revision::bigint
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
create or replace function public.sync_pull_v3(after_revision text default '0', batch_size integer default 200) returns jsonb
language sql security invoker set search_path='' as $$
with page as materialized(
 select * from public.sync_records where user_id=auth.uid() and entity_table in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions') and revision>after_revision::bigint
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
create function public.sync_pull_v4(after_revision text default '0', batch_size integer default 200) returns jsonb
language sql security invoker set search_path='' as $$
with page as materialized(
 select * from public.sync_records where user_id=auth.uid() and revision>after_revision::bigint
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


create function public.sync_apply_v4(operation_id uuid,entity_table text,entity_id text,action text,payload jsonb default null,base_revision text default null,base_updated_at text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 owner_id uuid=auth.uid(); item_id uuid; stored jsonb; previous public.sync_records%rowtype;
 receipt public.sync_receipts%rowtype; request_hash text; result jsonb; record jsonb;
 columns text[]; assignments text; column_list text; source_list text; equal_content boolean=false;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if entity_table not in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions') or action not in ('put','delete') then raise exception 'Unsupported sync operation' using errcode='22023'; end if;
 if entity_table='workspace_settings' and (entity_id<>'settings' or action<>'put') then raise exception 'Invalid settings operation' using errcode='22023'; end if;
 item_id=case when entity_table='workspace_settings' then owner_id else entity_id::uuid end;
 request_hash=md5(jsonb_build_object('table',entity_table,'id',entity_id,'action',action,'payload',payload,'base_revision',base_revision,'base_updated_at',base_updated_at)::text);
 -- Serialize duplicate deliveries before the mutation. Lost responses can be retried safely.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||operation_id::text,0));
 -- Distinct devices may create the same deterministic occurrence simultaneously.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||entity_table||item_id::text,1));
 select * into receipt from public.sync_receipts r where r.user_id=owner_id and r.operation_id=sync_apply_v4.operation_id;
 if found then
  if receipt.request_hash<>request_hash then raise exception 'Operation ID reused with different content' using errcode='22023'; end if;
  return receipt.response;
 end if;
 -- Lock the business row first, matching ordinary Web CRUD lock order.
 execute format('select to_jsonb(r) from public.%I r where %I=$1 and user_id=$2 for update',entity_table,case when entity_table='workspace_settings' then 'user_id' else 'id' end) into stored using item_id,owner_id;
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v4.entity_table and r.id=item_id;
 columns=case entity_table
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
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v4.entity_table and r.id=item_id;
 record=jsonb_build_object('user_id',owner_id,'entity_table',entity_table,'id',item_id,'revision',coalesce(previous.revision,0)::text,'deleted',coalesce(previous.deleted,true),'payload',previous.payload);
 result=jsonb_build_object('status','applied','record',record);
 insert into public.sync_receipts values(owner_id,operation_id,request_hash,result);
 return result;
end;
$$;
revoke all on function public.sync_apply_v4(uuid,text,text,text,jsonb,text,text) from public,anon;
grant execute on function public.sync_apply_v4(uuid,text,text,text,jsonb,text,text) to authenticated;

CREATE FUNCTION public.sync_capabilities_v4() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_object('protocol',4,'entities',jsonb_build_array('subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions')) WHERE auth.uid() IS NOT NULL; $$;
REVOKE ALL ON FUNCTION public.sync_capabilities_v4() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.sync_capabilities_v4() TO authenticated;
CREATE FUNCTION public.reorder_board(parent_id uuid, ordered_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE owner_id uuid=auth.uid(); actual uuid[]; expected uuid[];
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.projects WHERE id=parent_id AND user_id=owner_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project unavailable' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.tasks WHERE project_id=parent_id AND user_id=owner_id ORDER BY id FOR UPDATE;
 SELECT coalesce(array_agg(id ORDER BY id),'{}') INTO actual FROM public.tasks WHERE project_id=parent_id AND user_id=owner_id;
 SELECT coalesce(array_agg(id ORDER BY id),'{}') INTO expected FROM unnest(ordered_ids) id;
 IF ordered_ids IS NULL OR actual<>expected THEN RAISE EXCEPTION 'Project changed; reload before reordering' USING errcode='22023'; END IF;
 INSERT INTO public.board_positions(id,user_id,task_id,position)
 SELECT o.id,owner_id,o.id,(o.ordinality-1)::integer FROM unnest(ordered_ids) WITH ORDINALITY o(id,ordinality)
 ON CONFLICT(id) DO UPDATE SET position=excluded.position;
END; $$;
REVOKE ALL ON FUNCTION public.reorder_board(uuid,uuid[]) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.reorder_board(uuid,uuid[]) TO authenticated;
commit;
