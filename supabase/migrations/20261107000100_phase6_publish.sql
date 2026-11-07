-- Phase 6 additions: template delivery, publishing, and the participant
-- write paths the student flow needs. Everything stays behind the edit key
-- hash and every write is scoped to the caller's own organization.

-- Private template bucket. Files are served through short-lived signed URLs
-- created by the browser after the storage policy below confirms the template
-- belongs to a live event of an active organization.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'templates',
  'templates',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies run as the requesting role, and anon has no read access to
-- the public tables. A security-definer helper keeps that check possible
-- without opening the tables up.
create or replace function public.is_live_template(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.categories c
      join public.events e on e.id = c.event_id
      join public.organizations o on o.id = e.organization_id
     where c.template_path = p_name
       and o.status = 'active'
       and e.status = 'live'
       and (e.expiry_date is null or e.expiry_date >= current_date)
  );
$$;

revoke all on function public.is_live_template(text) from public;
grant execute on function public.is_live_template(text) to anon, authenticated;

drop policy if exists "templates readable for live events" on storage.objects;

create policy "templates readable for live events"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'templates'
    and public.is_live_template(name)
  );

-- Uploads, replacements, and deletes are service-role only: no insert,
-- update, or delete policy is created for anon or authenticated.

create or replace function public.record_download(
  p_link_id text,
  p_event_id uuid,
  p_category_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_link_id is null or p_link_id !~ '^[a-z2-7]{10}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not exists (
    select 1
      from public.categories c
      join public.events e on e.id = c.event_id
      join public.organizations o on o.id = e.organization_id
     where o.link_id = p_link_id
       and o.status = 'active'
       and e.id = p_event_id
       and e.status = 'live'
       and (e.expiry_date is null or e.expiry_date >= current_date)
       and c.id = p_category_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  update public.events
     set downloads = downloads + 1
   where id = p_event_id;

  update public.categories
     set downloads = downloads + 1
   where id = p_category_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.organizer_set_event_status(
  p_edit_key_hash text,
  p_event_id uuid,
  p_status text,
  p_expiry_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_event public.events%rowtype;
  v_expiry date;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('draft', 'live', 'paused', 'expired') then
    raise exception 'invalid_event_status' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  select *
    into v_event
    from public.events
   where id = p_event_id
     and organization_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'event_not_found');
  end if;

  v_expiry := coalesce(p_expiry_date, v_event.expiry_date);

  if p_status = 'live' then
    if v_expiry is null or v_expiry < current_date then
      return jsonb_build_object('status', 'error', 'code', 'expiry_required');
    end if;

    if not exists (select 1 from public.participants where event_id = p_event_id) then
      return jsonb_build_object('status', 'error', 'code', 'no_participants');
    end if;
  end if;

  update public.events
     set status = p_status,
         expiry_date = v_expiry
   where id = p_event_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.organizer_add_participants(
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
  v_existing integer;
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

  select count(*) into v_existing from public.participants where event_id = p_event_id;

  if v_existing + v_incoming > 5000 then
    return jsonb_build_object('status', 'error', 'code', 'participant_limit_reached');
  end if;

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

create or replace function public.organizer_clear_participants(
  p_edit_key_hash text,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
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

  delete from public.participants where event_id = p_event_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.organizer_delete_event(
  p_edit_key_hash text,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  delete from public.events
   where id = p_event_id
     and organization_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'event_not_found');
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.record_download(text, uuid, uuid) from public;
revoke all on function public.organizer_set_event_status(text, uuid, text, date) from public;
revoke all on function public.organizer_add_participants(text, uuid, jsonb) from public;
revoke all on function public.organizer_clear_participants(text, uuid) from public;
revoke all on function public.organizer_delete_event(text, uuid) from public;

grant execute on function public.record_download(text, uuid, uuid) to anon, authenticated;
grant execute on function public.organizer_set_event_status(text, uuid, text, date) to anon, authenticated;
grant execute on function public.organizer_add_participants(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.organizer_clear_participants(text, uuid) to anon, authenticated;
grant execute on function public.organizer_delete_event(text, uuid) to anon, authenticated;
