-- Phase 7: per-category template and design settings.
--
-- The browser compresses the image and sends it to the upload function, which
-- stores it under the organization and event it belongs to. This function is
-- the only way for an organizer to attach that path to a category.

create or replace function public.organizer_update_category(
  p_edit_key_hash text,
  p_category_id uuid,
  p_template_path text default null,
  p_design_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_event_id uuid;
  v_path text := nullif(btrim(coalesce(p_template_path, '')), '');
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;
  if p_category_id is null then
    raise exception 'invalid_category_id' using errcode = '22023';
  end if;
  if p_design_settings is null
     or jsonb_typeof(p_design_settings) <> 'object'
     or octet_length(p_design_settings::text) > 20000 then
    raise exception 'invalid_design_settings' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  select c.event_id
    into v_event_id
    from public.categories c
    join public.events e on e.id = c.event_id
   where c.id = p_category_id
     and e.organization_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'category_not_found');
  end if;

  -- A template path always starts with the caller's organization and event,
  -- so one organizer can never point a category at another organization's
  -- object even if they learn its path.
  if v_path is not null then
    if char_length(v_path) > 300 then
      raise exception 'invalid_template_path' using errcode = '22023';
    end if;

    if v_path !~ (
      '^' || v_org_id::text || '/' || v_event_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]*$'
    ) then
      return jsonb_build_object('status', 'error', 'code', 'invalid_template_path');
    end if;
  end if;

  update public.categories
     set template_path = v_path,
         design_settings = p_design_settings
   where id = p_category_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.organizer_update_category(text, uuid, text, jsonb) from public;
grant execute on function public.organizer_update_category(text, uuid, text, jsonb)
  to anon, authenticated;

-- The upload function runs with the service role and needs to find the
-- category it is replacing without scanning the whole table.
create index if not exists categories_template_path_idx
  on public.categories (template_path)
  where template_path is not null;
