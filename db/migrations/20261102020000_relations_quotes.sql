begin;
set local lock_timeout='5s';
CREATE TABLE public.object_nodes(id uuid NOT NULL,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('task','note','project','event','resource')),PRIMARY KEY(id,user_id,kind));
ALTER TABLE public.object_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.object_nodes FOR SELECT TO authenticated USING((select auth.uid())=user_id);
REVOKE ALL ON public.object_nodes FROM public,anon,authenticated; GRANT SELECT ON public.object_nodes TO authenticated;
CREATE FUNCTION timora_private.maintain_object_node() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF TG_OP='DELETE' THEN DELETE FROM public.object_nodes WHERE id=OLD.id AND user_id=OLD.user_id AND kind=TG_ARGV[0]; RETURN OLD; ELSE INSERT INTO public.object_nodes VALUES(NEW.id,NEW.user_id,TG_ARGV[0]); RETURN NEW; END IF; END; $$; REVOKE ALL ON FUNCTION timora_private.maintain_object_node() FROM public,anon,authenticated;
INSERT INTO public.object_nodes SELECT id,user_id,'task' FROM public.tasks;
CREATE TRIGGER object_node AFTER INSERT OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION timora_private.maintain_object_node('task');
INSERT INTO public.object_nodes SELECT id,user_id,'note' FROM public.notes;
CREATE TRIGGER object_node AFTER INSERT OR DELETE ON public.notes FOR EACH ROW EXECUTE FUNCTION timora_private.maintain_object_node('note');
INSERT INTO public.object_nodes SELECT id,user_id,'project' FROM public.projects;
CREATE TRIGGER object_node AFTER INSERT OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION timora_private.maintain_object_node('project');
INSERT INTO public.object_nodes SELECT id,user_id,'event' FROM public.events;
CREATE TRIGGER object_node AFTER INSERT OR DELETE ON public.events FOR EACH ROW EXECUTE FUNCTION timora_private.maintain_object_node('event');
INSERT INTO public.object_nodes SELECT id,user_id,'resource' FROM public.library_items;
CREATE TRIGGER object_node AFTER INSERT OR DELETE ON public.library_items FOR EACH ROW EXECUTE FUNCTION timora_private.maintain_object_node('resource');
CREATE TABLE public.object_relations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),source_id uuid NOT NULL,source_kind text NOT NULL,target_id uuid NOT NULL,target_kind text NOT NULL,kind text NOT NULL CHECK(kind IN ('references','belongs_to','depends_on')),UNIQUE(user_id,source_id,source_kind,target_id,target_kind,kind),FOREIGN KEY(source_id,user_id,source_kind) REFERENCES public.object_nodes(id,user_id,kind) ON DELETE CASCADE,FOREIGN KEY(target_id,user_id,target_kind) REFERENCES public.object_nodes(id,user_id,kind) ON DELETE CASCADE,CHECK(source_id<>target_id OR source_kind<>target_kind));
CREATE INDEX object_relations_owner_updated ON public.object_relations(user_id,updated_at,id);
ALTER TABLE public.object_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON public.object_relations TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
REVOKE ALL ON public.object_relations FROM public,anon,authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON public.object_relations TO authenticated;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.object_relations FOR EACH ROW EXECUTE FUNCTION public.timora_touch_updated_at();
CREATE TRIGGER capture_sync AFTER INSERT OR UPDATE OR DELETE ON public.object_relations FOR EACH ROW EXECUTE FUNCTION timora_private.capture_sync();
CREATE TABLE public.user_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),content text NOT NULL CHECK(char_length(btrim(content)) BETWEEN 1 AND 2000),author text NOT NULL CHECK(char_length(author)<=200),favorite integer NOT NULL CHECK(favorite IN (0,1)));
CREATE INDEX user_quotes_owner_updated ON public.user_quotes(user_id,updated_at,id);
ALTER TABLE public.user_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON public.user_quotes TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
REVOKE ALL ON public.user_quotes FROM public,anon,authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_quotes TO authenticated;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.user_quotes FOR EACH ROW EXECUTE FUNCTION public.timora_touch_updated_at();
CREATE TRIGGER capture_sync AFTER INSERT OR UPDATE OR DELETE ON public.user_quotes FOR EACH ROW EXECUTE FUNCTION timora_private.capture_sync();
CREATE INDEX relation_source ON public.object_relations(source_id,user_id,source_kind);
CREATE INDEX relation_target ON public.object_relations(target_id,user_id,target_kind);
CREATE FUNCTION timora_private.check_relation_cycle() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF NEW.kind='depends_on' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,7));
 IF EXISTS(WITH RECURSIVE reachable(id,kind) AS (SELECT NEW.target_id,NEW.target_kind UNION SELECT r.target_id,r.target_kind FROM public.object_relations r JOIN reachable p ON r.source_id=p.id AND r.source_kind=p.kind WHERE r.kind='depends_on' AND r.user_id=NEW.user_id AND r.id<>NEW.id) SELECT 1 FROM reachable WHERE id=NEW.source_id AND kind=NEW.source_kind) THEN RAISE EXCEPTION 'Dependency cycle' USING errcode='23514'; END IF;
 END IF; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION timora_private.check_relation_cycle() FROM public,anon,authenticated;
CREATE TRIGGER relation_cycle BEFORE INSERT OR UPDATE ON public.object_relations FOR EACH ROW EXECUTE FUNCTION timora_private.check_relation_cycle();
ALTER TABLE public.sync_records DROP CONSTRAINT sync_records_entity_table_check;
ALTER TABLE public.sync_records ADD CONSTRAINT sync_records_entity_table_check CHECK(entity_table IN ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences','object_relations','user_quotes'));
create or replace function public.sync_pull_v5(after_revision text default '0', batch_size integer default 200) returns jsonb
language sql security invoker set search_path='' as $$
with page as materialized(
 select * from public.sync_records where user_id=auth.uid() and entity_table in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences') and revision>after_revision::bigint
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



create function public.sync_apply_v6(operation_id uuid,entity_table text,entity_id text,action text,payload jsonb default null,base_revision text default null,base_updated_at text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 owner_id uuid=auth.uid(); item_id uuid; stored jsonb; previous public.sync_records%rowtype;
 receipt public.sync_receipts%rowtype; request_hash text; result jsonb; record jsonb;
 columns text[]; assignments text; column_list text; source_list text; equal_content boolean=false;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if entity_table not in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences','object_relations','user_quotes') or action not in ('put','delete') then raise exception 'Unsupported sync operation' using errcode='22023'; end if;
 if entity_table='workspace_settings' and (entity_id<>'settings' or action<>'put') then raise exception 'Invalid settings operation' using errcode='22023'; end if;
 item_id=case when entity_table='workspace_settings' then owner_id else entity_id::uuid end;
 request_hash=md5(jsonb_build_object('table',entity_table,'id',entity_id,'action',action,'payload',payload,'base_revision',base_revision,'base_updated_at',base_updated_at)::text);
 -- Serialize duplicate deliveries before the mutation. Lost responses can be retried safely.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||operation_id::text,0));
 -- Distinct devices may create the same deterministic occurrence simultaneously.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||entity_table||item_id::text,1));
 select * into receipt from public.sync_receipts r where r.user_id=owner_id and r.operation_id=sync_apply_v6.operation_id;
 if found then
  if receipt.request_hash<>request_hash then raise exception 'Operation ID reused with different content' using errcode='22023'; end if;
  return receipt.response;
 end if;
 -- Lock the business row first, matching ordinary Web CRUD lock order.
 execute format('select to_jsonb(r) from public.%I r where %I=$1 and user_id=$2 for update',entity_table,case when entity_table='workspace_settings' then 'user_id' else 'id' end) into stored using item_id,owner_id;
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v6.entity_table and r.id=item_id;
 columns=case entity_table
 when 'object_relations' then array['source_id','source_kind','target_id','target_kind','kind']
 when 'user_quotes' then array['content','author','favorite']
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
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v6.entity_table and r.id=item_id;
 record=jsonb_build_object('user_id',owner_id,'entity_table',entity_table,'id',item_id,'revision',coalesce(previous.revision,0)::text,'deleted',coalesce(previous.deleted,true),'payload',previous.payload);
 result=jsonb_build_object('status','applied','record',record);
 insert into public.sync_receipts values(owner_id,operation_id,request_hash,result);
 return result;
end;
$$;
revoke all on function public.sync_apply_v6(uuid,text,text,text,jsonb,text,text) from public,anon;
grant execute on function public.sync_apply_v6(uuid,text,text,text,jsonb,text,text) to authenticated;


CREATE FUNCTION public.sync_pull_v6(after_revision text DEFAULT '0',batch_size integer DEFAULT 200) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
WITH RECURSIVE page AS MATERIALIZED(SELECT * FROM public.sync_records WHERE user_id=auth.uid() AND revision>after_revision::bigint ORDER BY revision LIMIT greatest(1,least(batch_size,200))), ancestors AS (
 SELECT * FROM page UNION SELECT parent.* FROM ancestors child CROSS JOIN LATERAL (VALUES ('projects', child.payload->>'project_id'),('tasks', child.payload->>'task_id'),('routines', child.payload->>'routine_id'),('notes', child.payload->>'note_id'),('tags', child.payload->>'tag_id'),('task_recurrences', child.payload->>'recurrence_id'),(CASE child.payload->>'source_kind' WHEN 'task' THEN 'tasks' WHEN 'note' THEN 'notes' WHEN 'project' THEN 'projects' WHEN 'event' THEN 'events' WHEN 'resource' THEN 'library_items' END,child.payload->>'source_id'),(CASE child.payload->>'target_kind' WHEN 'task' THEN 'tasks' WHEN 'note' THEN 'notes' WHEN 'project' THEN 'projects' WHEN 'event' THEN 'events' WHEN 'resource' THEN 'library_items' END,child.payload->>'target_id')) ref(entity_table,id) JOIN public.sync_records parent ON parent.user_id=auth.uid() AND parent.entity_table=ref.entity_table AND parent.id=ref.id::uuid
), records AS (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) ORDER BY revision),'[]'::jsonb) data,max(revision) last_revision FROM page), dependencies AS (
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) ORDER BY CASE entity_table WHEN 'projects' THEN 0 WHEN 'tags' THEN 1 WHEN 'routines' THEN 1 WHEN 'task_recurrences' THEN 1 WHEN 'tasks' THEN 2 WHEN 'notes' THEN 2 WHEN 'events' THEN 2 WHEN 'library_items' THEN 2 ELSE 3 END,revision),'[]'::jsonb) data FROM ancestors
) SELECT jsonb_build_object('records',records.data,'dependencies',dependencies.data,'cursor',coalesce(records.last_revision::text,after_revision),'has_more',(SELECT count(*)>=greatest(1,least(batch_size,200)) FROM page)) FROM records,dependencies; $$;
REVOKE ALL ON FUNCTION public.sync_pull_v6(text,integer) FROM public,anon; GRANT EXECUTE ON FUNCTION public.sync_pull_v6(text,integer) TO authenticated;
CREATE FUNCTION public.sync_capabilities_v6() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_object('protocol',6,'entities',jsonb_build_array('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences','object_relations','user_quotes')) WHERE auth.uid() IS NOT NULL; $$;
REVOKE ALL ON FUNCTION public.sync_capabilities_v6() FROM public,anon; GRANT EXECUTE ON FUNCTION public.sync_capabilities_v6() TO authenticated;
commit;
