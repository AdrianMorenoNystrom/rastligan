-- One existing row is one break. Scores count individual match wins, never sets.
-- Keep physical names and legacy RPCs to preserve IDs, audit logs, receipts and imports.
comment on table public.matches is 'Registered breaks (legacy physical name). One row is one break between two players.';
comment on column public.matches.score1 is 'Individual matches won by player1 during this break. No set data is recorded.';
comment on column public.matches.score2 is 'Individual matches won by player2 during this break. No set data is recorded.';
comment on column public.matches.played_on is 'Date of the break; order within the day is unknown.';

create or replace function public.break_snapshot() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('breaks', snapshot->'matches', 'count', snapshot->'count')
  from (select public.league_snapshot() as snapshot) s;
$$;
revoke all on function public.break_snapshot() from public, anon, authenticated;
grant execute on function public.break_snapshot() to anon, authenticated, service_role;
comment on function public.break_snapshot() is 'Public, complete break snapshot using the existing public read policy; no editor or import metadata.';
