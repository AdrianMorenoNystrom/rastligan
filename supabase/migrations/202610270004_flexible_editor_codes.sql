-- Code length is a user choice. Prehash with the per-credential bcrypt salt so
-- bcrypt never truncates a code. Version 1 keeps existing credentials working.
alter table private.editor_credentials
  add column hash_version smallint not null default 1
  check (hash_version in (1, 2));

create function private.editor_code_material(p_code text, p_salt text) returns text
language sql immutable strict set search_path = '' as $$
  select encode(extensions.hmac(
    convert_to(p_code, 'UTF8'),
    convert_to(substr(p_salt, 8, 22), 'UTF8'),
    'sha256'
  ), 'base64');
$$;
revoke all on function private.editor_code_material(text,text) from public,anon,authenticated;

create or replace function public.admin_editor(p_player text,p_action text,p_code text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare salt text;
begin
  if p_action='code' then
    if p_code is null or p_code='' then raise exception 'code_required'; end if;
    salt:=extensions.gen_salt('bf',12);
    insert into private.editor_credentials(player_id,code_hash,hash_version)
      values(p_player,extensions.crypt(private.editor_code_material(p_code,salt),salt),2)
      on conflict(player_id) do update set code_hash=excluded.code_hash,hash_version=2,changed_at=now();
  elsif p_action in ('enable','disable') then
    update private.editor_credentials set enabled=(p_action='enable') where player_id=p_player;
    if not found then raise exception 'credentials_not_initialized'; end if;
  elsif p_action<>'revoke' then raise exception 'invalid_action'; end if;
  if p_action<>'enable' then update private.editor_sessions set revoked_at=now() where player_id=p_player and revoked_at is null; end if;
end; $$;

create or replace function public.editor_login(p_player text,p_code text,p_ip_hash text,p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c private.editor_credentials; identity_key text := 'player:' || coalesce(p_player,'?'); ip_key text := 'ip:' || p_ip_hash;
  material text; dummy_salt text;
begin
  if p_player is null or p_code is null or p_code='' or p_ip_hash is null or p_token_hash is null
    or p_player not in ('adrian','dave','elias') or p_ip_hash !~ '^[a-f0-9]{64}$' or p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('error','invalid_login');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(identity_key,0));
  perform pg_advisory_xact_lock(hashtextextended(ip_key,1));
  delete from private.login_limits where window_start < now() - interval '1 day';
  insert into private.login_limits(key,window_start,attempts) values(identity_key,now(),0),(ip_key,now(),0)
    on conflict(key) do update set window_start = case when private.login_limits.window_start <= now()-interval '15 minutes' then now() else private.login_limits.window_start end,
    attempts = case when private.login_limits.window_start <= now()-interval '15 minutes' then 0 else private.login_limits.attempts end;
  if exists(select 1 from private.login_limits where (key=identity_key and attempts>=5) or (key=ip_key and attempts>=30)) then
    return jsonb_build_object('error','rate_limited');
  end if;
  update private.login_limits set attempts=attempts+1 where key in (identity_key,ip_key);
  select * into c from private.editor_credentials where player_id=p_player for update;
  if c.player_id is null then
    dummy_salt:=extensions.gen_salt('bf',12);
    perform extensions.crypt(private.editor_code_material(p_code,dummy_salt),dummy_salt);
    return jsonb_build_object('error','invalid_login');
  end if;
  if c.hash_version=2 then
    material:=private.editor_code_material(p_code,c.code_hash);
  elsif octet_length(p_code)<=72 then
    material:=p_code;
  else
    -- A long input must never authenticate against a truncated legacy code.
    perform extensions.crypt(private.editor_code_material(p_code,c.code_hash),c.code_hash);
    return jsonb_build_object('error','invalid_login');
  end if;
  if extensions.crypt(material,c.code_hash) <> c.code_hash or not c.enabled then return jsonb_build_object('error','invalid_login'); end if;
  insert into private.editor_sessions(token_hash,player_id) values(p_token_hash,p_player);
  return jsonb_build_object('player_id',p_player,'expires_at',now()+interval '30 days','absolute_expires_at',now()+interval '90 days');
end; $$;

revoke execute on function public.admin_editor(text,text,text),public.editor_login(text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_editor(text,text,text),public.editor_login(text,text,text,text) to service_role;
