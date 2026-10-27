create function public.admin_bootstrap() returns jsonb
language plpgsql security definer set search_path='' as $$
declare p text; code text; result jsonb:='[]';
begin
  perform pg_advisory_xact_lock(427103);
  if exists(select 1 from private.editor_credentials) then raise exception 'already_initialized_use_code_command'; end if;
  foreach p in array array['adrian','dave','elias'] loop
    code:=encode(extensions.gen_random_bytes(24),'hex');
    perform public.admin_editor(p,'code',code);
    result:=result||jsonb_build_array(jsonb_build_object('player_id',p,'code',code));
  end loop;
  return result;
end; $$;
revoke execute on function public.admin_bootstrap() from public,anon,authenticated;
grant execute on function public.admin_bootstrap() to service_role;
