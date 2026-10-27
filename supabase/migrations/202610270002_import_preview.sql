create function public.import_preview(p_source text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('source_row',source_row,'status',status,'match_id',match_id,'match',imported_values)),'[]'::jsonb)
  from private.import_log where source=p_source and status='imported';
$$;
revoke execute on function public.import_preview(text) from public,anon,authenticated;
grant execute on function public.import_preview(text) to service_role;
