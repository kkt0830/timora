-- Isolated PostgreSQL role/claim verification; always rolls fixtures back.
begin;
insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
insert into public.workspace_settings(display_name,avatar_url) values ('A nickname','https://example.com/a.png');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$
declare n int;
begin
  select count(*) into n from public.workspace_settings;
  if n <> 0 then raise exception 'Other account profile exposed'; end if;
  update public.workspace_settings set display_name='stolen';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Other account profile writable'; end if;
  begin
    insert into public.workspace_settings(user_id,display_name) values ('10000000-0000-0000-0000-000000000001','forged');
    raise exception 'Forged profile ownership accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.workspace_settings(avatar_url) values ('javascript:alert(1)');
    raise exception 'Unsafe avatar accepted';
  exception when check_violation then null; end;
end $$;
reset role;
rollback;
