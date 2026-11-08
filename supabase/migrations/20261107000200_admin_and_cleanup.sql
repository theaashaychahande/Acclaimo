-- Admin deletion and retention helpers. The admin secret is still checked on
-- every call; nothing here is reachable without it.

create or replace function public.admin_delete_organization(
  p_secret text,
  p_organization_id uuid,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_check jsonb;
begin
  v_check := public.admin_check(p_secret, p_device_id);
  if v_check ->> 'status' <> 'ok' then
    return v_check;
  end if;

  delete from public.organizations where id = p_organization_id;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'organization_not_found');
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- Removes events whose expiry is older than the retention window. Categories
-- and participant hashes go with them through the existing cascades.
-- Template files must also be removed through the Storage API when template
-- upload ships; this function cannot delete the underlying object store file.
create or replace function public.cleanup_expired(p_retention_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff date;
  v_events integer;
begin
  if p_retention_days is null or p_retention_days < 0 or p_retention_days > 3650 then
    raise exception 'invalid_retention_days' using errcode = '22023';
  end if;

  v_cutoff := current_date - p_retention_days;

  with removed as (
    delete from public.events
     where expiry_date is not null
       and expiry_date < v_cutoff
    returning 1
  )
  select count(*) into v_events from removed;

  return jsonb_build_object('status', 'ok', 'events_removed', v_events);
end;
$$;

revoke all on function public.admin_delete_organization(text, uuid, text) from public;
grant execute on function public.admin_delete_organization(text, uuid, text) to anon, authenticated;

revoke all on function public.cleanup_expired(integer) from public, anon, authenticated;

-- To run the retention job daily on Supabase, enable pg_cron once in the SQL
-- editor and then schedule it:
--
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'acclaimo-cleanup',
--     '0 3 * * *',
--     $$select public.cleanup_expired(90);$$
--   );
