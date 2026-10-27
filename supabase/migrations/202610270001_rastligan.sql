create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.players (
  id text primary key check (id in ('adrian','dave','elias')),
  name text not null unique,
  display_order integer not null unique,
  created_at timestamptz not null default now()
);
insert into public.players(id,name,display_order) values ('adrian','Adrian',1),('dave','Dave',2),('elias','Elias',3);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  player1_id text not null references public.players(id),
  player2_id text not null references public.players(id),
  score1 numeric not null check (score1 >= 0 and score1 = trunc(score1) and score1 <= 9007199254740991),
  score2 numeric not null check (score2 >= 0 and score2 = trunc(score2) and score2 <= 9007199254740991),
  played_on date not null check (played_on between date '0001-01-01' and date '9999-12-31'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  import_source text,
  import_source_id text,
  idempotency_key uuid unique,
  check (player1_id < player2_id),
  check (score1 + score2 > 0),
  check ((import_source is null) = (import_source_id is null)),
  unique (import_source,import_source_id)
);
create index matches_date_idx on public.matches(played_on desc,id);
create index matches_pair_date_idx on public.matches(player1_id,player2_id,played_on desc);
create index matches_player2_idx on public.matches(player2_id,played_on desc);

create table private.editor_credentials (
  player_id text primary key references public.players(id),
  code_hash text not null,
  enabled boolean not null default true,
  changed_at timestamptz not null default now()
);
create table private.editor_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  player_id text not null references private.editor_credentials(player_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  absolute_expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz
);
create index sessions_player_idx on private.editor_sessions(player_id);
create table private.login_limits (
  key text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
create table private.match_audit_log (
  id bigint generated always as identity primary key,
  match_id uuid not null,
  action text not null check (action in ('create','update','delete','import')),
  editor_id text references public.players(id),
  occurred_at timestamptz not null default clock_timestamp(),
  old_values jsonb,
  new_values jsonb
);
create table private.write_receipts (
  key uuid primary key,
  editor_id text not null references public.players(id),
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create table private.import_log (
  source text not null,
  source_row text not null,
  status text not null,
  error text,
  match_id uuid,
  imported_values jsonb,
  checked_at timestamptz not null default now(),
  primary key (source,source_row)
);

alter table public.players enable row level security;
alter table public.matches enable row level security;
create policy players_read on public.players for select to anon, authenticated using (true);
create policy matches_read on public.matches for select to anon, authenticated using (true);
revoke all on public.players, public.matches from public, anon, authenticated;
grant select on public.players, public.matches to anon, authenticated;
grant all on public.players, public.matches to service_role;
alter table private.editor_credentials enable row level security;
alter table private.editor_sessions enable row level security;
alter table private.login_limits enable row level security;
alter table private.match_audit_log enable row level security;
alter table private.write_receipts enable row level security;
alter table private.import_log enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;

-- One JSON value from one MVCC snapshot. API row caps cannot truncate its matches.
create function public.league_snapshot() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('matches',coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'player1_id',player1_id,'player2_id',player2_id,'score1',score1,'score2',score2,
    'played_on',played_on,'created_at',created_at,'updated_at',updated_at
  ) order by played_on desc,id),'[]'::jsonb),'count',count(*)) from public.matches;
$$;

create function public.editor_login(p_player text,p_code text,p_ip_hash text,p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c private.editor_credentials; identity_key text := 'player:' || coalesce(p_player,'?'); ip_key text := 'ip:' || p_ip_hash;
begin
  if p_player is null or p_code is null or p_ip_hash is null or p_token_hash is null or p_player not in ('adrian','dave','elias') or length(p_code) > 72 or p_ip_hash !~ '^[a-f0-9]{64}$' or p_token_hash !~ '^[a-f0-9]{64}$' then
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
  -- Fixed cost also for credentials that have not yet been bootstrapped.
  if c.player_id is null then
    perform extensions.crypt(p_code,extensions.gen_salt('bf',12));
    return jsonb_build_object('error','invalid_login');
  end if;
  if extensions.crypt(p_code,c.code_hash) <> c.code_hash or not c.enabled then return jsonb_build_object('error','invalid_login'); end if;
  insert into private.editor_sessions(token_hash,player_id) values(p_token_hash,p_player);
  return jsonb_build_object('player_id',p_player,'expires_at',now()+interval '30 days','absolute_expires_at',now()+interval '90 days');
end; $$;

create function private.session_player(p_token_hash text) returns text
language plpgsql security definer set search_path = '' as $$
declare s private.editor_sessions;
begin
  select es.* into s from private.editor_sessions es join private.editor_credentials c on c.player_id=es.player_id
    where es.token_hash=p_token_hash and es.revoked_at is null and es.expires_at>now() and es.absolute_expires_at>now() and c.enabled for update of c,es;
  if s.player_id is null then raise exception 'unauthorized' using errcode='28000'; end if;
  update private.editor_sessions set expires_at=least(absolute_expires_at,now()+interval '30 days') where token_hash=p_token_hash;
  return s.player_id;
end; $$;

create function public.editor_session(p_token_hash text,p_logout boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare who text;
begin
  who := private.session_player(p_token_hash);
  if p_logout then update private.editor_sessions set revoked_at=now() where token_hash=p_token_hash; end if;
  return (select jsonb_build_object('player_id',who,'expires_at',expires_at,'absolute_expires_at',absolute_expires_at) from private.editor_sessions where token_hash=p_token_hash);
end; $$;

create function public.editor_mutate(p_token_hash text,p_action text,p_match jsonb,p_key uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare who text; old public.matches; item public.matches; receipt private.write_receipts;
  p1 text := p_match->>'player1_id'; p2 text := p_match->>'player2_id'; s1 numeric := (p_match->>'score1')::numeric; s2 numeric := (p_match->>'score2')::numeric;
  swap text; swapped numeric;
begin
  who := private.session_player(p_token_hash);
  if p_action='create' then
    if p_key is null then raise exception 'idempotency_required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_key::text,2));
    select * into receipt from private.write_receipts where key=p_key;
    if receipt.key is not null then
      if receipt.editor_id<>who or receipt.payload<>p_match then raise exception 'idempotency_conflict' using errcode='40001'; end if;
      return receipt.result;
    end if;
    if p1>p2 then swap:=p1; p1:=p2; p2:=swap; swapped:=s1; s1:=s2; s2:=swapped; end if;
    insert into public.matches(player1_id,player2_id,score1,score2,played_on,idempotency_key) values(p1,p2,s1,s2,(p_match->>'played_on')::date,p_key) returning * into item;
    insert into private.match_audit_log(match_id,action,editor_id,new_values) values(item.id,'create',who,to_jsonb(item));
    insert into private.write_receipts(key,editor_id,payload,result) values(p_key,who,p_match,to_jsonb(item));
    return to_jsonb(item);
  elsif p_action in ('update','delete') then
    select * into old from public.matches where id=(p_match->>'id')::uuid for update;
    if old.id is null then raise exception 'not_found' using errcode='P0002'; end if;
    if p_match->>'updated_at' is null or old.updated_at<>(p_match->>'updated_at')::timestamptz then raise exception 'match_changed' using errcode='40001'; end if;
    if p_action='delete' then
      delete from public.matches where id=old.id;
      insert into private.match_audit_log(match_id,action,editor_id,old_values) values(old.id,'delete',who,to_jsonb(old));
      return jsonb_build_object('id',old.id);
    end if;
    -- Editing keeps the registered pair fixed.
    if p1<>old.player1_id or p2<>old.player2_id then raise exception 'pair_locked'; end if;
    update public.matches set score1=s1,score2=s2,played_on=(p_match->>'played_on')::date,updated_at=clock_timestamp() where id=old.id returning * into item;
    insert into private.match_audit_log(match_id,action,editor_id,old_values,new_values) values(old.id,'update',who,to_jsonb(old),to_jsonb(item));
    return to_jsonb(item);
  end if;
  raise exception 'invalid_action';
end; $$;

create function public.admin_editor(p_player text,p_action text,p_code text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_action='code' then
    if length(p_code)<16 or length(p_code)>72 then raise exception 'code_length_16_to_72'; end if;
    insert into private.editor_credentials(player_id,code_hash) values(p_player,extensions.crypt(p_code,extensions.gen_salt('bf',12)))
      on conflict(player_id) do update set code_hash=excluded.code_hash,changed_at=now();
  elsif p_action in ('enable','disable') then
    update private.editor_credentials set enabled=(p_action='enable') where player_id=p_player;
    if not found then raise exception 'credentials_not_initialized'; end if;
  elsif p_action<>'revoke' then raise exception 'invalid_action'; end if;
  if p_action<>'enable' then update private.editor_sessions set revoked_at=now() where player_id=p_player and revoked_at is null; end if;
end; $$;

create function public.import_matches(p_source text,p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare row jsonb; m jsonb; existing private.import_log; item public.matches; report jsonb:='[]'; status text; err text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source,3));
  for row in select value from jsonb_array_elements(p_rows) loop
    m:=row->'match'; err:=null; status:='imported';
    select * into existing from private.import_log where source=p_source and source_row=row->>'source_row';
    if existing.status='imported' then
      status:=case when existing.imported_values=m then 'already_imported' else 'source_changed' end;
      report:=report||jsonb_build_array(jsonb_build_object('source_row',row->>'source_row','status',status,'match_id',existing.match_id));
      continue;
    end if;
    if m is null or m='null'::jsonb then status:=coalesce(row->>'status','invalid'); err:=row->>'error';
    else
      begin
        insert into public.matches(player1_id,player2_id,score1,score2,played_on,import_source,import_source_id)
          values(m->>'player1_id',m->>'player2_id',(m->>'score1')::numeric,(m->>'score2')::numeric,(m->>'played_on')::date,p_source,row->>'source_row') returning * into item;
        insert into private.match_audit_log(match_id,action,new_values) values(item.id,'import',to_jsonb(item));
      exception when others then status:='invalid'; err:='database_validation_failed'; item:=null;
      end;
    end if;
    insert into private.import_log(source,source_row,status,error,match_id,imported_values) values(p_source,row->>'source_row',status,err,item.id,m)
      on conflict(source,source_row) do update set status=excluded.status,error=excluded.error,match_id=excluded.match_id,imported_values=excluded.imported_values,checked_at=now();
    report:=report||jsonb_build_array(jsonb_build_object('source_row',row->>'source_row','status',status,'error',err,'match_id',item.id));
    item:=null;
  end loop;
  return report;
end; $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke execute on function public.league_snapshot() from public;
grant execute on function public.league_snapshot() to anon,authenticated,service_role;
revoke execute on function public.editor_login(text,text,text,text),public.editor_session(text,boolean),public.editor_mutate(text,text,jsonb,uuid),public.admin_editor(text,text,text),public.import_matches(text,jsonb) from public,anon,authenticated;
grant execute on function public.editor_login(text,text,text,text),public.editor_session(text,boolean),public.editor_mutate(text,text,jsonb,uuid),public.admin_editor(text,text,text),public.import_matches(text,jsonb) to service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke all on tables from public,anon,authenticated;
alter default privileges in schema private revoke execute on functions from public,anon,authenticated;
