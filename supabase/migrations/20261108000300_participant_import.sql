-- Phase 4: list import and list maintenance.
--
-- The browser parses the sheet, validates it, and hashes names locally. These
-- functions only ever receive hashes, category ids, and position text.

create or replace function public.organizer_replace_participants(
  p_edit_key_hash text,
  p_event_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_org_id uuid;
  v_row jsonb;
  v_name_hash text;
  v_identifier_hash text;
  v_category_id uuid;
  v_position text;
  v_incoming integer;
  v_inserted integer;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  if not exists (
    select 1 from public.events
     where id = p_event_id and organization_id = v_org_id
  ) then
    return jsonb_build_object('status', 'error', 'code', 'event_not_found');
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_participant_rows' using errcode = '22023';
  end if;

  v_incoming := jsonb_array_length(p_rows);

  if v_incoming < 1 or v_incoming > 5000 then
    raise exception 'invalid_participant_count' using errcode = '22023';
  end if;

  -- Validate every row before deleting anything. A bad row aborts the whole
  -- transaction, so an interrupted replace leaves the old list untouched.
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_name_hash := v_row ->> 'name_hash';
    v_identifier_hash := nullif(btrim(coalesce(v_row ->> 'identifier_hash', '')), '');
    v_position := nullif(btrim(coalesce(v_row ->> 'position_text', '')), '');

    if v_name_hash is null or v_name_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid_name_hash' using errcode = '22023';
    end if;
    if v_identifier_hash is not null and v_identifier_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid_identifier_hash' using errcode = '22023';
    end if;
    if v_position is not null and char_length(v_position) > 60 then
      raise exception 'invalid_position_text' using errcode = '22023';
    end if;

    begin
      v_category_id := (v_row ->> 'category_id')::uuid;
    exception when others then
      raise exception 'invalid_category_id' using errcode = '22023';
    end;

    if not exists (
      select 1 from public.categories
       where id = v_category_id and event_id = p_event_id
    ) then
      return jsonb_build_object('status', 'error', 'code', 'invalid_category');
    end if;
  end loop;

  delete from public.participants where event_id = p_event_id;

  insert into public.participants (
    event_id, category_id, name_hash, identifier_hash, extra_text, duplicate_flag
  )
  select
    p_event_id,
    (r ->> 'category_id')::uuid,
    r ->> 'name_hash',
    nullif(btrim(coalesce(r ->> 'identifier_hash', '')), ''),
    nullif(btrim(coalesce(r ->> 'position_text', '')), ''),
    nullif(btrim(coalesce(r ->> 'identifier_hash', '')), '') is not null
  from jsonb_array_elements(p_rows) as r
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'inserted', v_inserted,
    'skipped', v_incoming - v_inserted
  );
end;
$$;

create or replace function public.organizer_update_participant(
  p_edit_key_hash text,
  p_event_id uuid,
  p_name_hash text,
  p_identifier_hash text,
  p_category_id uuid,
  p_position_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_identifier_hash text := nullif(btrim(coalesce(p_identifier_hash, '')), '');
  v_position text := nullif(btrim(coalesce(p_position_text, '')), '');
  v_updated integer;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;
  if p_name_hash is null or p_name_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_name_hash' using errcode = '22023';
  end if;
  if v_identifier_hash is not null and v_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_identifier_hash' using errcode = '22023';
  end if;
  if v_position is not null and char_length(v_position) > 60 then
    raise exception 'invalid_position_text' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  if not exists (
    select 1 from public.events
     where id = p_event_id and organization_id = v_org_id
  ) then
    return jsonb_build_object('status', 'error', 'code', 'event_not_found');
  end if;

  if not exists (
    select 1 from public.categories
     where id = p_category_id and event_id = p_event_id
  ) then
    return jsonb_build_object('status', 'error', 'code', 'invalid_category');
  end if;

  update public.participants
     set category_id = p_category_id,
         extra_text = v_position,
         duplicate_flag = v_identifier_hash is not null
   where event_id = p_event_id
     and name_hash = p_name_hash
     and identifier_hash is not distinct from v_identifier_hash;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('status', 'error', 'code', 'participant_not_found');
  end if;

  return jsonb_build_object('status', 'ok', 'updated', v_updated);
end;
$$;

create or replace function public.organizer_remove_participant(
  p_edit_key_hash text,
  p_event_id uuid,
  p_name_hash text,
  p_identifier_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_identifier_hash text := nullif(btrim(coalesce(p_identifier_hash, '')), '');
  v_removed integer;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;
  if p_name_hash is null or p_name_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_name_hash' using errcode = '22023';
  end if;
  if v_identifier_hash is not null and v_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_identifier_hash' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  if not exists (
    select 1 from public.events
     where id = p_event_id and organization_id = v_org_id
  ) then
    return jsonb_build_object('status', 'error', 'code', 'event_not_found');
  end if;

  delete from public.participants
   where event_id = p_event_id
     and name_hash = p_name_hash
     and identifier_hash is not distinct from v_identifier_hash;

  get diagnostics v_removed = row_count;

  if v_removed = 0 then
    return jsonb_build_object('status', 'error', 'code', 'participant_not_found');
  end if;

  return jsonb_build_object('status', 'ok', 'removed', v_removed);
end;
$$;

create or replace function public.organizer_rename_category(
  p_edit_key_hash text,
  p_category_id uuid,
  p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_event_id uuid;
  v_label text := btrim(coalesce(p_label, ''));
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;
  if char_length(v_label) not between 1 and 40 then
    raise exception 'invalid_category_label' using errcode = '22023';
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

  if v_event_id is null then
    return jsonb_build_object('status', 'error', 'code', 'category_not_found');
  end if;

  if exists (
    select 1 from public.categories
     where event_id = v_event_id
       and id <> p_category_id
       and lower(label) = lower(v_label)
  ) then
    return jsonb_build_object('status', 'error', 'code', 'category_label_taken');
  end if;

  update public.categories set label = v_label where id = p_category_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.organizer_reorder_categories(
  p_edit_key_hash text,
  p_event_id uuid,
  p_category_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_count integer;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  if not exists (
    select 1 from public.events
     where id = p_event_id and organization_id = v_org_id
  ) then
    return jsonb_build_object('status', 'error', 'code', 'event_not_found');
  end if;

  if p_category_ids is null or cardinality(p_category_ids) > 6 then
    raise exception 'invalid_category_order' using errcode = '22023';
  end if;

  select count(*) into v_count from public.categories where event_id = p_event_id;

  if v_count <> cardinality(p_category_ids)
     or (select count(distinct id) from unnest(p_category_ids) as id) <> v_count
     or exists (
       select 1 from unnest(p_category_ids) as id
        where not exists (
          select 1 from public.categories c where c.id = id and c.event_id = p_event_id
        )
     ) then
    return jsonb_build_object('status', 'error', 'code', 'invalid_category_order');
  end if;

  update public.categories c
     set sort_order = ordered.position - 1
    from unnest(p_category_ids) with ordinality as ordered(id, position)
   where c.id = ordered.id
     and c.event_id = p_event_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.organizer_set_default_category(
  p_edit_key_hash text,
  p_category_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_event_id uuid;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
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

  if v_event_id is null then
    return jsonb_build_object('status', 'error', 'code', 'category_not_found');
  end if;

  update public.events
     set default_category_id = p_category_id
   where id = v_event_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.organizer_replace_participants(text, uuid, jsonb) from public;
revoke all on function public.organizer_update_participant(text, uuid, text, text, uuid, text) from public;
revoke all on function public.organizer_remove_participant(text, uuid, text, text) from public;
revoke all on function public.organizer_rename_category(text, uuid, text) from public;
revoke all on function public.organizer_reorder_categories(text, uuid, uuid[]) from public;
revoke all on function public.organizer_set_default_category(text, uuid) from public;

grant execute on function public.organizer_replace_participants(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.organizer_update_participant(text, uuid, text, text, uuid, text) to anon, authenticated;
grant execute on function public.organizer_remove_participant(text, uuid, text, text) to anon, authenticated;
grant execute on function public.organizer_rename_category(text, uuid, text) to anon, authenticated;
grant execute on function public.organizer_reorder_categories(text, uuid, uuid[]) to anon, authenticated;
grant execute on function public.organizer_set_default_category(text, uuid) to anon, authenticated;
