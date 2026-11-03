begin;
set local lock_timeout='5s';
CREATE UNIQUE INDEX library_items_id_owner ON public.library_items(id,user_id);
CREATE TABLE public.attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),resource_id uuid,filename text NOT NULL CHECK(char_length(filename) BETWEEN 1 AND 255),mime text NOT NULL CHECK(mime IN ('application/pdf','image/png','image/jpeg','image/webp','text/plain')),byte_size bigint NOT NULL CHECK(byte_size BETWEEN 1 AND 26214400),sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),FOREIGN KEY(resource_id,user_id) REFERENCES public.library_items(id,user_id) ON DELETE RESTRICT);
CREATE INDEX attachments_parent ON public.attachments(resource_id,user_id);
CREATE INDEX attachments_owner_updated ON public.attachments(user_id,updated_at,id);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON public.attachments TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
REVOKE ALL ON public.attachments FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.attachments TO authenticated;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.attachments FOR EACH ROW EXECUTE FUNCTION public.timora_touch_updated_at();
CREATE TRIGGER capture_sync AFTER INSERT OR UPDATE OR DELETE ON public.attachments FOR EACH ROW EXECUTE FUNCTION timora_private.capture_sync();
ALTER TABLE public.sync_records DROP CONSTRAINT sync_records_entity_table_check; ALTER TABLE public.sync_records ADD CONSTRAINT sync_records_entity_table_check CHECK(entity_table IN ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences','object_relations','user_quotes','attachments'));
CREATE OR REPLACE FUNCTION public.sync_pull_v6(after_revision text DEFAULT '0',batch_size integer DEFAULT 200) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
WITH RECURSIVE page AS MATERIALIZED(SELECT * FROM public.sync_records WHERE user_id=auth.uid() AND entity_table IN ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences','object_relations','user_quotes') AND revision>after_revision::bigint ORDER BY revision LIMIT greatest(1,least(batch_size,200))), ancestors AS (
 SELECT * FROM page UNION SELECT parent.* FROM ancestors child CROSS JOIN LATERAL (VALUES ('projects', child.payload->>'project_id'),('tasks', child.payload->>'task_id'),('routines', child.payload->>'routine_id'),('notes', child.payload->>'note_id'),('tags', child.payload->>'tag_id'),('task_recurrences', child.payload->>'recurrence_id'),(CASE child.payload->>'source_kind' WHEN 'task' THEN 'tasks' WHEN 'note' THEN 'notes' WHEN 'project' THEN 'projects' WHEN 'event' THEN 'events' WHEN 'resource' THEN 'library_items' END,child.payload->>'source_id'),(CASE child.payload->>'target_kind' WHEN 'task' THEN 'tasks' WHEN 'note' THEN 'notes' WHEN 'project' THEN 'projects' WHEN 'event' THEN 'events' WHEN 'resource' THEN 'library_items' END,child.payload->>'target_id')) ref(entity_table,id) JOIN public.sync_records parent ON parent.user_id=auth.uid() AND parent.entity_table=ref.entity_table AND parent.id=ref.id::uuid
), records AS (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) ORDER BY revision),'[]'::jsonb) data,max(revision) last_revision FROM page), dependencies AS (
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) ORDER BY CASE entity_table WHEN 'projects' THEN 0 WHEN 'tags' THEN 1 WHEN 'routines' THEN 1 WHEN 'task_recurrences' THEN 1 WHEN 'tasks' THEN 2 WHEN 'notes' THEN 2 WHEN 'events' THEN 2 WHEN 'library_items' THEN 2 ELSE 3 END,revision),'[]'::jsonb) data FROM ancestors
) SELECT jsonb_build_object('records',records.data,'dependencies',dependencies.data,'cursor',coalesce(records.last_revision::text,after_revision),'has_more',(SELECT count(*)>=greatest(1,least(batch_size,200)) FROM page)) FROM records,dependencies; $$;
REVOKE ALL ON FUNCTION public.sync_pull_v6(text,integer) FROM public,anon; GRANT EXECUTE ON FUNCTION public.sync_pull_v6(text,integer) TO authenticated;
CREATE FUNCTION public.sync_pull_v7(after_revision text DEFAULT '0',batch_size integer DEFAULT 200) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
WITH RECURSIVE page AS MATERIALIZED(SELECT * FROM public.sync_records WHERE user_id=auth.uid() AND revision>after_revision::bigint ORDER BY revision LIMIT greatest(1,least(batch_size,200))), ancestors AS (
 SELECT * FROM page UNION SELECT parent.* FROM ancestors child CROSS JOIN LATERAL (VALUES ('library_items', child.payload->>'resource_id'),('projects', child.payload->>'project_id'),('tasks', child.payload->>'task_id'),('routines', child.payload->>'routine_id'),('notes', child.payload->>'note_id'),('tags', child.payload->>'tag_id'),('task_recurrences', child.payload->>'recurrence_id'),(CASE child.payload->>'source_kind' WHEN 'task' THEN 'tasks' WHEN 'note' THEN 'notes' WHEN 'project' THEN 'projects' WHEN 'event' THEN 'events' WHEN 'resource' THEN 'library_items' END,child.payload->>'source_id'),(CASE child.payload->>'target_kind' WHEN 'task' THEN 'tasks' WHEN 'note' THEN 'notes' WHEN 'project' THEN 'projects' WHEN 'event' THEN 'events' WHEN 'resource' THEN 'library_items' END,child.payload->>'target_id')) ref(entity_table,id) JOIN public.sync_records parent ON parent.user_id=auth.uid() AND parent.entity_table=ref.entity_table AND parent.id=ref.id::uuid
), records AS (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) ORDER BY revision),'[]'::jsonb) data,max(revision) last_revision FROM page), dependencies AS (
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) ORDER BY CASE entity_table WHEN 'projects' THEN 0 WHEN 'tags' THEN 1 WHEN 'routines' THEN 1 WHEN 'task_recurrences' THEN 1 WHEN 'tasks' THEN 2 WHEN 'notes' THEN 2 WHEN 'events' THEN 2 WHEN 'library_items' THEN 2 ELSE 3 END,revision),'[]'::jsonb) data FROM ancestors
) SELECT jsonb_build_object('records',records.data,'dependencies',dependencies.data,'cursor',coalesce(records.last_revision::text,after_revision),'has_more',(SELECT count(*)>=greatest(1,least(batch_size,200)) FROM page)) FROM records,dependencies; $$;
REVOKE ALL ON FUNCTION public.sync_pull_v7(text,integer) FROM public,anon; GRANT EXECUTE ON FUNCTION public.sync_pull_v7(text,integer) TO authenticated;
create function public.sync_apply_v7(operation_id uuid,entity_table text,entity_id text,action text,payload jsonb default null,base_revision text default null,base_updated_at text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 owner_id uuid=auth.uid(); item_id uuid; stored jsonb; previous public.sync_records%rowtype;
 receipt public.sync_receipts%rowtype; request_hash text; result jsonb; record jsonb;
 columns text[]; assignments text; column_list text; source_list text; equal_content boolean=false;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if entity_table not in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences','object_relations','user_quotes','attachments') or action not in ('put','delete') then raise exception 'Unsupported sync operation' using errcode='22023'; end if;
 if entity_table='workspace_settings' and (entity_id<>'settings' or action<>'put') then raise exception 'Invalid settings operation' using errcode='22023'; end if;
 item_id=case when entity_table='workspace_settings' then owner_id else entity_id::uuid end;
 request_hash=md5(jsonb_build_object('table',entity_table,'id',entity_id,'action',action,'payload',payload,'base_revision',base_revision,'base_updated_at',base_updated_at)::text);
 -- Serialize duplicate deliveries before the mutation. Lost responses can be retried safely.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||operation_id::text,0));
 -- Distinct devices may create the same deterministic occurrence simultaneously.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||entity_table||item_id::text,1));
 select * into receipt from public.sync_receipts r where r.user_id=owner_id and r.operation_id=sync_apply_v7.operation_id;
 if found then
  if receipt.request_hash<>request_hash then raise exception 'Operation ID reused with different content' using errcode='22023'; end if;
  return receipt.response;
 end if;
 -- Lock the business row first, matching ordinary Web CRUD lock order.
 execute format('select to_jsonb(r) from public.%I r where %I=$1 and user_id=$2 for update',entity_table,case when entity_table='workspace_settings' then 'user_id' else 'id' end) into stored using item_id,owner_id;
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v7.entity_table and r.id=item_id;
 columns=case entity_table
 when 'attachments' then array['resource_id','filename','mime','byte_size','sha256']
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
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply_v7.entity_table and r.id=item_id;
 record=jsonb_build_object('user_id',owner_id,'entity_table',entity_table,'id',item_id,'revision',coalesce(previous.revision,0)::text,'deleted',coalesce(previous.deleted,true),'payload',previous.payload);
 result=jsonb_build_object('status','applied','record',record);
 insert into public.sync_receipts values(owner_id,operation_id,request_hash,result);
 return result;
end;
$$;
revoke all on function public.sync_apply_v7(uuid,text,text,text,jsonb,text,text) from public,anon;
grant execute on function public.sync_apply_v7(uuid,text,text,text,jsonb,text,text) to authenticated;


CREATE FUNCTION public.sync_capabilities_v7() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_object('protocol',7,'entities',jsonb_build_array('projects','tasks','notes','events','library_items','inbox_items','workspace_settings','subtasks','routines','routine_completions','tags','note_tags','note_templates','task_blocks','board_positions','task_recurrences','task_occurrences','object_relations','user_quotes','attachments')) WHERE auth.uid() IS NOT NULL; $$; REVOKE ALL ON FUNCTION public.sync_capabilities_v7() FROM public,anon; GRANT EXECUTE ON FUNCTION public.sync_capabilities_v7() TO authenticated;
commit;
