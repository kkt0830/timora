-- Separate Supabase-only provisioning step. Review before production application.
-- Not part of the isolated PostgreSQL migrations (storage schema is Supabase-owned).
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('timora-attachments','timora-attachments',false,26214400,array['application/pdf','image/png','image/jpeg','image/webp','text/plain'])
on conflict(id) do nothing;
do $$ begin if not exists(select 1 from storage.buckets where id='timora-attachments' and public=false and file_size_limit=26214400 and allowed_mime_types=array['application/pdf','image/png','image/jpeg','image/webp','text/plain']) then raise exception 'Existing attachment bucket must be private with the expected file limits'; end if; end $$;
create policy timora_attachment_read on storage.objects for select to authenticated
using(bucket_id='timora-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy timora_attachment_insert on storage.objects for insert to authenticated
with check(bucket_id='timora-attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Bytes are immutable; no overwrite or automatic remote garbage collection.
commit;
