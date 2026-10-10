-- Generated with Supabase CLI migration new native_workspace_sync.
-- Additive metadata only: existing records, UUIDs and RLS stay in place.
begin;
set local lock_timeout='5s';
lock table public.projects,public.tasks,public.notes,public.events,public.library_items,public.inbox_items,public.workspace_settings in share row exclusive mode;
create schema if not exists timora_private;
revoke all on schema timora_private from public,anon,authenticated;
create table timora_private.sync_clock(user_id uuid primary key references auth.users(id) on delete cascade, revision bigint not null default 0);
create table public.sync_records(
 user_id uuid not null references auth.users(id) on delete cascade,
 entity_table text not null check(entity_table in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings')),
 id uuid not null, revision bigint not null, deleted boolean not null, payload jsonb,
 primary key(user_id,entity_table,id),
 check((deleted and payload is null) or (not deleted and payload->>'user_id'=user_id::text))
);
create unique index sync_records_owner_revision on public.sync_records(user_id,revision);
alter table public.sync_records enable row level security;
create policy sync_read_owner on public.sync_records for select to authenticated using((select auth.uid())=user_id);
revoke all on public.sync_records from public,anon,authenticated;
grant select on public.sync_records to authenticated;
create table public.sync_receipts(user_id uuid not null references auth.users(id) on delete cascade, operation_id uuid not null, request_hash text not null, response jsonb not null, primary key(user_id,operation_id));
alter table public.sync_receipts enable row level security;
create policy receipt_read_owner on public.sync_receipts for select to authenticated using((select auth.uid())=user_id);
create policy receipt_insert_owner on public.sync_receipts for insert to authenticated with check((select auth.uid())=user_id and response->'record'->>'user_id'=user_id::text);
revoke all on public.sync_receipts from public,anon,authenticated;
grant select,insert on public.sync_receipts to authenticated;

-- Internal trigger only. A per-owner row lock makes revisions follow COMMIT order.
-- Auth identity is never obtained from editable user_metadata.
create function timora_private.capture_sync() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb; owner_id uuid; item_id uuid; version bigint;
begin
 item=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 owner_id=(item->>'user_id')::uuid;
 if auth.uid() is not null and auth.uid()<>owner_id then raise exception 'Sync owner mismatch' using errcode='42501'; end if;
 item_id=case when TG_TABLE_NAME='workspace_settings' then owner_id else (item->>'id')::uuid end;
 insert into timora_private.sync_clock(user_id,revision) values(owner_id,1)
 on conflict(user_id) do update set revision=timora_private.sync_clock.revision+1 returning revision into version;
 insert into public.sync_records(user_id,entity_table,id,revision,deleted,payload)
 values(owner_id,TG_TABLE_NAME,item_id,version,TG_OP='DELETE',case when TG_OP='DELETE' then null else item end)
 on conflict(user_id,entity_table,id) do update set revision=excluded.revision,deleted=excluded.deleted,payload=excluded.payload;
 return case when TG_OP='DELETE' then OLD else NEW end;
end;
$$;
revoke all on function timora_private.capture_sync() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['projects','tasks','notes','events','library_items','inbox_items','workspace_settings'] loop
  execute format('create trigger capture_sync after insert or update or delete on public.%I for each row execute function timora_private.capture_sync()',t);
 end loop;
end;
$$;
-- Seed existing rows without changing their timestamps or content.
with existing as (
 select user_id,'projects'::text entity_table,id,to_jsonb(p) payload from public.projects p
 union all select user_id,'tasks',id,to_jsonb(t) from public.tasks t
 union all select user_id,'notes',id,to_jsonb(n) from public.notes n
 union all select user_id,'events',id,to_jsonb(e) from public.events e
 union all select user_id,'library_items',id,to_jsonb(l) from public.library_items l
 union all select user_id,'inbox_items',id,to_jsonb(i) from public.inbox_items i
 union all select user_id,'workspace_settings',user_id,to_jsonb(s) from public.workspace_settings s
)
insert into public.sync_records(user_id,entity_table,id,revision,deleted,payload)
select user_id,entity_table,id,row_number() over(partition by user_id order by entity_table,id),false,payload from existing;
insert into timora_private.sync_clock(user_id,revision) select user_id,max(revision) from public.sync_records group by user_id;
alter table timora_private.sync_clock enable row level security;

create function public.sync_pull(after_revision text default '0', batch_size integer default 200) returns jsonb
language sql security invoker set search_path='' as $$
with page as materialized(
 select * from public.sync_records where user_id=auth.uid() and revision>after_revision::bigint
 order by revision limit greatest(1,least(batch_size,200))
), records as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_table',entity_table,'id',id,'revision',revision::text,'deleted',deleted,'payload',payload) order by revision),'[]'::jsonb) data, max(revision) last_revision from page
), dependencies as (
 select coalesce(jsonb_agg(jsonb_build_object('user_id',r.user_id,'entity_table',r.entity_table,'id',r.id,'revision',r.revision::text,'deleted',r.deleted,'payload',r.payload)),'[]'::jsonb) data
 from public.sync_records r where r.user_id=auth.uid() and r.entity_table='projects'
 and r.id in(select (payload->>'project_id')::uuid from page where payload->>'project_id' is not null)
)
select jsonb_build_object('records',records.data,'dependencies',dependencies.data,'cursor',coalesce(records.last_revision::text,after_revision),'has_more',(select count(*)>=greatest(1,least(batch_size,200)) from page)) from records,dependencies;
$$;
revoke all on function public.sync_pull(text,integer) from public,anon;
grant execute on function public.sync_pull(text,integer) to authenticated;

create function public.sync_apply(operation_id uuid,entity_table text,entity_id text,action text,payload jsonb default null,base_revision text default null,base_updated_at text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 owner_id uuid=auth.uid(); item_id uuid; stored jsonb; previous public.sync_records%rowtype;
 receipt public.sync_receipts%rowtype; request_hash text; result jsonb; record jsonb;
 columns text[]; assignments text; column_list text; source_list text; equal_content boolean=false;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if entity_table not in ('projects','tasks','notes','events','library_items','inbox_items','workspace_settings') or action not in ('put','delete') then raise exception 'Unsupported sync operation' using errcode='22023'; end if;
 if entity_table='workspace_settings' and (entity_id<>'settings' or action<>'put') then raise exception 'Invalid settings operation' using errcode='22023'; end if;
 item_id=case when entity_table='workspace_settings' then owner_id else entity_id::uuid end;
 request_hash=md5(jsonb_build_object('table',entity_table,'id',entity_id,'action',action,'payload',payload,'base_revision',base_revision,'base_updated_at',base_updated_at)::text);
 -- Serialize duplicate deliveries before the mutation. Lost responses can be retried safely.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||operation_id::text,0));
 select * into receipt from public.sync_receipts r where r.user_id=owner_id and r.operation_id=sync_apply.operation_id;
 if found then
  if receipt.request_hash<>request_hash then raise exception 'Operation ID reused with different content' using errcode='22023'; end if;
  return receipt.response;
 end if;
 -- Lock the business row first, matching ordinary Web CRUD lock order.
 execute format('select to_jsonb(r) from public.%I r where %I=$1 and user_id=$2 for update',entity_table,case when entity_table='workspace_settings' then 'user_id' else 'id' end) into stored using item_id,owner_id;
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply.entity_table and r.id=item_id;
 columns=case entity_table
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
 if not equal_content and (
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
 select * into previous from public.sync_records r where r.user_id=owner_id and r.entity_table=sync_apply.entity_table and r.id=item_id;
 record=jsonb_build_object('user_id',owner_id,'entity_table',entity_table,'id',item_id,'revision',coalesce(previous.revision,0)::text,'deleted',coalesce(previous.deleted,true),'payload',previous.payload);
 result=jsonb_build_object('status','applied','record',record);
 insert into public.sync_receipts values(owner_id,operation_id,request_hash,result);
 return result;
end;
$$;
revoke all on function public.sync_apply(uuid,text,text,text,jsonb,text,text) from public,anon;
grant execute on function public.sync_apply(uuid,text,text,text,jsonb,text,text) to authenticated;
commit;
