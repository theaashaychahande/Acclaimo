-- Narrow RPC surface. Every function validates its input, and the public
-- schema grants execute only on the functions listed at the bottom.

create function public.sha256_hex(p_value text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(digest(p_value, 'sha256'), 'hex');
$$;

create function public.request_ip()
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_headers jsonb;
  v_forwarded text;
begin
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_forwarded := v_headers ->> 'x-forwarded-for';
  if v_forwarded is not null and btrim(v_forwarded) <> '' then
    return btrim(split_part(v_forwarded, ',', 1));
  end if;

  return coalesce(nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''), 'unknown');
end;
$$;

-- A device identifier is preferred; the request IP is the fallback. Either way
-- only a hash reaches the rate-limit tables.
create function public.actor_hash(p_device_id text)
returns text
language plpgsql
stable
set search_path = public, extensions, pg_temp
as $$
declare
  v_value text;
begin
  v_value := nullif(btrim(coalesce(p_device_id, '')), '');

  if v_value is not null and char_length(v_value) > 128 then
    raise exception 'invalid_device_id' using errcode = '22023';
  end if;

  if v_value is null then
    v_value := 'ip:' || public.request_ip();
  else
    v_value := 'device:' || v_value;
  end if;

  return encode(digest(v_value, 'sha256'), 'hex');
end;
$$;

create function public.consume_rate_limit(
  p_bucket text,
  p_subject_hash text,
  p_organization_id uuid,
  p_limit integer,
  p_window interval
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_oldest timestamptz;
  v_retry integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_bucket || ':' || p_subject_hash || ':' || coalesce(p_organization_id::text, ''),
      0
    )
  );

  delete from public.rate_limits
   where bucket = p_bucket
     and subject_hash = p_subject_hash
     and organization_id is not distinct from p_organization_id
     and created_at < now() - interval '1 day';

  select count(*), min(created_at)
    into v_count, v_oldest
    from public.rate_limits
   where bucket = p_bucket
     and subject_hash = p_subject_hash
     and organization_id is not distinct from p_organization_id
     and created_at >= now() - p_window;

  if v_count >= p_limit then
    v_retry := greatest(
      1,
      ceil(extract(epoch from (v_oldest + p_window - now())))::integer
    );

    return jsonb_build_object(
      'allowed', false,
      'retry_after', v_retry,
      'remaining', 0
    );
  end if;

  insert into public.rate_limits (bucket, subject_hash, organization_id)
  values (p_bucket, p_subject_hash, p_organization_id);

  return jsonb_build_object(
    'allowed', true,
    'retry_after', 0,
    'remaining', p_limit - v_count - 1
  );
end;
$$;

-- After eight consecutive misses, the same device waits sixty seconds before
-- trying that organization again.
create function public.lookup_streak_wait(p_organization_id uuid, p_subject_hash text)
returns integer
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_strikes smallint;
  v_last timestamptz;
begin
  select strikes, last_not_found_at
    into v_strikes, v_last
    from public.lookup_streaks
   where organization_id = p_organization_id
     and subject_hash = p_subject_hash;

  if not found or v_strikes < 8 then
    return 0;
  end if;

  return greatest(
    0,
    ceil(extract(epoch from (v_last + interval '60 seconds' - now())))::integer
  );
end;
$$;

create function public.record_lookup_result(
  p_organization_id uuid,
  p_subject_hash text,
  p_found boolean
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_found then
    delete from public.lookup_streaks
     where organization_id = p_organization_id
       and subject_hash = p_subject_hash;
    return;
  end if;

  insert into public.lookup_streaks (organization_id, subject_hash, strikes, last_not_found_at)
  values (p_organization_id, p_subject_hash, 1, now())
  on conflict (organization_id, subject_hash) do update
    set strikes = least(public.lookup_streaks.strikes + 1, 8),
        last_not_found_at = now();
end;
$$;

create function public.org_id_for_edit_key(p_edit_key_hash text)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select id
    from public.organizations
   where edit_key_hash = p_edit_key_hash
     and status = 'active'
   limit 1;
$$;

create function public.create_organization(
  p_name text,
  p_department_or_club text,
  p_public_contact text,
  p_link_id text,
  p_salt text,
  p_edit_key_hash text,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_department text := btrim(coalesce(p_department_or_club, ''));
  v_contact text := nullif(btrim(coalesce(p_public_contact, '')), '');
  v_subject text;
  v_limit jsonb;
  v_org public.organizations%rowtype;
begin
  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_organization_name' using errcode = '22023';
  end if;
  if char_length(v_department) not between 1 and 120 then
    raise exception 'invalid_department' using errcode = '22023';
  end if;
  if v_contact is not null and char_length(v_contact) > 200 then
    raise exception 'invalid_public_contact' using errcode = '22023';
  end if;
  if p_link_id is null or p_link_id !~ '^[a-z2-7]{10}$' then
    raise exception 'invalid_link_id' using errcode = '22023';
  end if;
  if p_salt is null or p_salt !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid_salt' using errcode = '22023';
  end if;
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;

  v_subject := public.actor_hash(p_device_id);
  v_limit := public.consume_rate_limit('create_org', v_subject, null, 3, interval '1 hour');

  if not coalesce((v_limit ->> 'allowed')::boolean, false) then
    return jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds', (v_limit ->> 'retry_after')::integer
    );
  end if;

  begin
    insert into public.organizations (
      link_id, name, department_or_club, public_contact, salt, edit_key_hash
    )
    values (
      p_link_id, v_name, v_department, v_contact, p_salt, p_edit_key_hash
    )
    returning * into v_org;
  exception when unique_violation then
    if exists (select 1 from public.organizations where link_id = p_link_id) then
      return jsonb_build_object('status', 'error', 'code', 'link_id_taken');
    end if;
    return jsonb_build_object('status', 'error', 'code', 'edit_key_taken');
  end;

  return jsonb_build_object(
    'status', 'ok',
    'organization', jsonb_build_object(
      'id', v_org.id,
      'link_id', v_org.link_id,
      'name', v_org.name,
      'department_or_club', v_org.department_or_club,
      'public_contact', v_org.public_contact,
      'salt', v_org.salt,
      'created_at', v_org.created_at
    )
  );
end;
$$;

create function public.verify_edit_key(
  p_edit_key_hash text,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subject text;
  v_limit jsonb;
  v_org public.organizations%rowtype;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;

  v_subject := public.actor_hash(p_device_id);
  v_limit := public.consume_rate_limit('login', v_subject, null, 5, interval '15 minutes');

  if not coalesce((v_limit ->> 'allowed')::boolean, false) then
    return jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds', (v_limit ->> 'retry_after')::integer
    );
  end if;

  select *
    into v_org
    from public.organizations
   where edit_key_hash = p_edit_key_hash
     and status = 'active';

  if not found then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'organization', jsonb_build_object(
      'id', v_org.id,
      'link_id', v_org.link_id,
      'name', v_org.name,
      'department_or_club', v_org.department_or_club,
      'public_contact', v_org.public_contact,
      'logo_path', v_org.logo_path,
      'created_at', v_org.created_at
    )
  );
end;
$$;

create function public.get_public_org_info(p_link_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org public.organizations%rowtype;
begin
  if p_link_id is null or p_link_id !~ '^[a-z2-7]{10}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select *
    into v_org
    from public.organizations
   where link_id = p_link_id
     and status = 'active';

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'organization', jsonb_build_object(
      'name', v_org.name,
      'department_or_club', v_org.department_or_club,
      'public_contact', v_org.public_contact,
      'logo_path', v_org.logo_path,
      'salt', v_org.salt
    ),
    'events', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'name', e.name,
            'date', e.date
          )
          order by e.date, e.name
        ),
        '[]'::jsonb
      )
      from public.events e
      where e.organization_id = v_org.id
        and e.status = 'live'
        and (e.expiry_date is null or e.expiry_date >= current_date)
    )
  );
end;
$$;

create function public.lookup(
  p_link_id text,
  p_name_hash text,
  p_identifier_hash text default null,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org public.organizations%rowtype;
  v_subject text;
  v_limit jsonb;
  v_retry integer;
  v_live_events integer;
  v_has_duplicate boolean;
  v_matches jsonb;
begin
  if p_link_id is null or p_link_id !~ '^[a-z2-7]{10}$' then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_name_hash is null or p_name_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_name_hash' using errcode = '22023';
  end if;
  if p_identifier_hash is not null and p_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_identifier_hash' using errcode = '22023';
  end if;

  select *
    into v_org
    from public.organizations
   where link_id = p_link_id
     and status = 'active';

  if not found then
    perform pg_sleep(0.02);
    return jsonb_build_object('status', 'not_found');
  end if;

  v_subject := public.actor_hash(p_device_id);

  perform pg_advisory_xact_lock(
    hashtextextended('lookup:' || v_org.id::text || ':' || v_subject, 0)
  );

  v_limit := public.consume_rate_limit('lookup', v_subject, v_org.id, 20, interval '10 minutes');

  if not coalesce((v_limit ->> 'allowed')::boolean, false) then
    return jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds', (v_limit ->> 'retry_after')::integer
    );
  end if;

  v_retry := public.lookup_streak_wait(v_org.id, v_subject);
  if v_retry > 0 then
    return jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds', v_retry
    );
  end if;

  select count(*)
    into v_live_events
    from public.events e
   where e.organization_id = v_org.id
     and e.status = 'live'
     and (e.expiry_date is null or e.expiry_date >= current_date);

  if v_live_events = 0 then
    perform pg_sleep(0.02);
    return jsonb_build_object('status', 'not_found');
  end if;

  select exists (
    select 1
      from public.participants p
      join public.events e on e.id = p.event_id
     where e.organization_id = v_org.id
       and e.status = 'live'
       and (e.expiry_date is null or e.expiry_date >= current_date)
       and p.name_hash = p_name_hash
       and p.duplicate_flag
  ) into v_has_duplicate;

  if v_has_duplicate and p_identifier_hash is null then
    perform public.record_lookup_result(v_org.id, v_subject, true);
    perform pg_sleep(0.02);

    return jsonb_build_object(
      'status', 'needs_identifier',
      'events', (
        select coalesce(
          jsonb_agg(jsonb_build_object(
            'event_id', duplicates.event_id,
            'event_name', duplicates.event_name,
            'event_date', duplicates.event_date
          ) order by duplicates.event_date, duplicates.event_name),
          '[]'::jsonb
        )
        from (
          select distinct e.id as event_id, e.name as event_name, e.date as event_date
            from public.participants p
            join public.events e on e.id = p.event_id
           where e.organization_id = v_org.id
             and e.status = 'live'
             and (e.expiry_date is null or e.expiry_date >= current_date)
             and p.name_hash = p_name_hash
             and p.duplicate_flag
        ) duplicates
      )
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'event_id', e.id,
        'event_name', e.name,
        'event_date', e.date,
        'category', jsonb_build_object(
          'id', c.id,
          'label', c.label,
          'template_path', c.template_path,
          'design_settings', c.design_settings
        ),
        'position_text', p.extra_text
      )
      order by e.date, e.name
    ),
    '[]'::jsonb
  )
    into v_matches
    from public.participants p
    join public.events e on e.id = p.event_id
    join public.categories c on c.id = p.category_id
   where e.organization_id = v_org.id
     and e.status = 'live'
     and (e.expiry_date is null or e.expiry_date >= current_date)
     and p.name_hash = p_name_hash
     and (not p.duplicate_flag or p.identifier_hash = p_identifier_hash);

  if jsonb_array_length(v_matches) = 0 then
    update public.events
       set searches = searches + 1,
           not_found = not_found + 1
     where organization_id = v_org.id
       and status = 'live'
       and (expiry_date is null or expiry_date >= current_date);

    perform public.record_lookup_result(v_org.id, v_subject, false);
    perform pg_sleep(0.02);

    return jsonb_build_object('status', 'not_found');
  end if;

  -- A category without an uploaded template is allowed: the browser draws the
  -- built-in design instead, so the student flow still completes.
  update public.events
     set searches = searches + 1
   where organization_id = v_org.id
     and status = 'live'
     and (expiry_date is null or expiry_date >= current_date);

  perform public.record_lookup_result(v_org.id, v_subject, true);
  perform pg_sleep(0.02);

  return jsonb_build_object('status', 'ok', 'matches', v_matches);
end;
$$;

create function public.organizer_get_dashboard(p_edit_key_hash text)
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

  return (
    select jsonb_build_object(
      'status', 'ok',
      'organization', jsonb_build_object(
        'id', o.id,
        'link_id', o.link_id,
        'name', o.name,
        'department_or_club', o.department_or_club,
        'public_contact', o.public_contact,
        'logo_path', o.logo_path,
        'salt', o.salt,
        'status', o.status,
        'created_at', o.created_at
      ),
      'events', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'name', e.name,
              'date', e.date,
              'description', e.description,
              'status', e.status,
              'expiry_date', e.expiry_date,
              'default_category_id', e.default_category_id,
              'searches', e.searches,
              'downloads', e.downloads,
              'not_found', e.not_found,
              'categories', (
                select coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'id', c.id,
                      'label', c.label,
                      'sort_order', c.sort_order,
                      'template_path', c.template_path,
                      'design_settings', c.design_settings,
                      'downloads', c.downloads,
                      'participant_count', (
                        select count(*)
                          from public.participants p
                         where p.category_id = c.id
                      )
                    )
                    order by c.sort_order, c.label
                  ),
                  '[]'::jsonb
                )
                from public.categories c
                where c.event_id = e.id
              )
            )
            order by e.date desc, e.created_at desc
          ),
          '[]'::jsonb
        )
        from public.events e
        where e.organization_id = o.id
      )
    )
    from public.organizations o
    where o.id = v_org_id
  );
end;
$$;

create function public.organizer_create_event(
  p_edit_key_hash text,
  p_name text,
  p_date date,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_event public.events%rowtype;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_event_name' using errcode = '22023';
  end if;
  if p_date is null then
    raise exception 'event_date_required' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'invalid_event_description' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  insert into public.events (organization_id, name, date, description)
  values (v_org_id, v_name, p_date, v_description)
  returning * into v_event;

  return jsonb_build_object(
    'status', 'ok',
    'event', jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'date', v_event.date,
      'description', v_event.description,
      'status', v_event.status,
      'default_category_id', v_event.default_category_id
    )
  );
end;
$$;

create function public.organizer_create_category(
  p_edit_key_hash text,
  p_event_id uuid,
  p_label text,
  p_sort_order integer default 0,
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
  v_owns_event boolean;
  v_label text := btrim(coalesce(p_label, ''));
  v_template_path text := nullif(btrim(coalesce(p_template_path, '')), '');
  v_category public.categories%rowtype;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;
  if char_length(v_label) not between 1 and 40 then
    raise exception 'invalid_category_label' using errcode = '22023';
  end if;
  if p_sort_order is null or p_sort_order not between 0 and 5 then
    raise exception 'invalid_category_position' using errcode = '22023';
  end if;
  if v_template_path is not null and char_length(v_template_path) > 300 then
    raise exception 'invalid_template_path' using errcode = '22023';
  end if;
  if p_design_settings is null or jsonb_typeof(p_design_settings) <> 'object' then
    raise exception 'invalid_design_settings' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  select exists (
    select 1
      from public.events
     where id = p_event_id
       and organization_id = v_org_id
  ) into v_owns_event;

  if not v_owns_event then
    return jsonb_build_object('status', 'error', 'code', 'event_not_found');
  end if;

  if (select count(*) from public.categories where event_id = p_event_id) >= 6 then
    return jsonb_build_object('status', 'error', 'code', 'category_limit_reached');
  end if;

  insert into public.categories (
    event_id, label, sort_order, template_path, design_settings
  )
  values (
    p_event_id, v_label, p_sort_order, v_template_path, p_design_settings
  )
  returning * into v_category;

  update public.events
     set default_category_id = v_category.id
   where id = p_event_id
     and default_category_id is null;

  return jsonb_build_object(
    'status', 'ok',
    'category', jsonb_build_object(
      'id', v_category.id,
      'event_id', v_category.event_id,
      'label', v_category.label,
      'sort_order', v_category.sort_order,
      'template_path', v_category.template_path,
      'design_settings', v_category.design_settings
    )
  );
end;
$$;

create function public.organizer_delete_category(
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
  v_default_category_id uuid;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;

  v_org_id := public.org_id_for_edit_key(p_edit_key_hash);
  if v_org_id is null then
    return jsonb_build_object('status', 'invalid_key');
  end if;

  select c.event_id, e.default_category_id
    into v_event_id, v_default_category_id
    from public.categories c
    join public.events e on e.id = c.event_id
   where c.id = p_category_id
     and e.organization_id = v_org_id;

  if v_event_id is null then
    return jsonb_build_object('status', 'error', 'code', 'category_not_found');
  end if;

  if exists (select 1 from public.participants where category_id = p_category_id) then
    return jsonb_build_object('status', 'error', 'code', 'category_has_participants');
  end if;

  if v_default_category_id = p_category_id then
    return jsonb_build_object('status', 'error', 'code', 'default_category_required');
  end if;

  delete from public.categories where id = p_category_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- The admin secret is stored only as a SHA-256 hash. It is provisioned in the
-- database, never sent to the browser. Only failed attempts are rate limited,
-- so normal admin work is never locked out.
create function public.admin_check(p_secret text, p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_subject text;
  v_ip_subject text;
  v_limit jsonb;
  v_ip_limit jsonb;
  v_retry integer;
  v_valid boolean;
begin
  if p_secret is null or btrim(p_secret) = '' then
    raise exception 'invalid_admin_secret' using errcode = '22023';
  end if;

  select exists (
    select 1
      from public.admin_config
     where id
       and secret_hash = public.sha256_hex(btrim(p_secret))
  ) into v_valid;

  if v_valid then
    return jsonb_build_object('status', 'ok');
  end if;

  v_subject := public.actor_hash(p_device_id);
  v_ip_subject := public.actor_hash(null);

  v_limit := public.consume_rate_limit('admin', v_subject, null, 8, interval '15 minutes');
  v_ip_limit := public.consume_rate_limit('admin_ip', v_ip_subject, null, 40, interval '15 minutes');

  if not coalesce((v_limit ->> 'allowed')::boolean, false)
     or not coalesce((v_ip_limit ->> 'allowed')::boolean, false) then
    v_retry := greatest(
      coalesce((v_limit ->> 'retry_after')::integer, 0),
      coalesce((v_ip_limit ->> 'retry_after')::integer, 0),
      1
    );

    return jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds', v_retry
    );
  end if;

  return jsonb_build_object('status', 'invalid_secret');
end;
$$;

create function public.verify_admin_secret(
  p_secret text,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.admin_check(p_secret, p_device_id);
end;
$$;

create function public.admin_list_organizations(
  p_secret text,
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

  return jsonb_build_object(
    'status', 'ok',
    'organizations', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'department_or_club', o.department_or_club,
            'link_id', o.link_id,
            'status', o.status,
            'created_at', o.created_at,
            'event_count', (
              select count(*) from public.events e where e.organization_id = o.id
            ),
            'category_count', (
              select count(*)
                from public.categories c
                join public.events e on e.id = c.event_id
               where e.organization_id = o.id
            ),
            'participant_count', (
              select count(*)
                from public.participants p
                join public.events e on e.id = p.event_id
               where e.organization_id = o.id
            ),
            'lookup_count', (
              select coalesce(sum(e.searches), 0)
                from public.events e
               where e.organization_id = o.id
            ),
            'not_found_count', (
              select coalesce(sum(e.not_found), 0)
                from public.events e
               where e.organization_id = o.id
            )
          )
          order by o.created_at desc
        ),
        '[]'::jsonb
      )
      from public.organizations o
    )
  );
end;
$$;

create function public.admin_set_organization_status(
  p_secret text,
  p_organization_id uuid,
  p_status text,
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
  if p_status is null or p_status not in ('active', 'disabled') then
    raise exception 'invalid_organization_status' using errcode = '22023';
  end if;

  v_check := public.admin_check(p_secret, p_device_id);
  if v_check ->> 'status' <> 'ok' then
    return v_check;
  end if;

  update public.organizations
     set status = p_status
   where id = p_organization_id;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'organization_not_found');
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

create function public.admin_regenerate_edit_key(
  p_secret text,
  p_organization_id uuid,
  p_new_edit_key_hash text,
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
  if p_new_edit_key_hash is null or p_new_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;

  v_check := public.admin_check(p_secret, p_device_id);
  if v_check ->> 'status' <> 'ok' then
    return v_check;
  end if;

  begin
    update public.organizations
       set edit_key_hash = p_new_edit_key_hash
     where id = p_organization_id;
  exception when unique_violation then
    return jsonb_build_object('status', 'error', 'code', 'edit_key_taken');
  end;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'organization_not_found');
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.sha256_hex(text) from public, anon, authenticated;
revoke all on function public.request_ip() from public, anon, authenticated;
revoke all on function public.actor_hash(text) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, text, uuid, integer, interval) from public, anon, authenticated;
revoke all on function public.lookup_streak_wait(uuid, text) from public, anon, authenticated;
revoke all on function public.record_lookup_result(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.org_id_for_edit_key(text) from public, anon, authenticated;
revoke all on function public.admin_check(text, text) from public, anon, authenticated;
revoke all on function public.enforce_category_limit() from public, anon, authenticated;
revoke all on function public.enforce_participant_limit() from public, anon, authenticated;

revoke all on function public.create_organization(text, text, text, text, text, text, text) from public;
revoke all on function public.verify_edit_key(text, text) from public;
revoke all on function public.get_public_org_info(text) from public;
revoke all on function public.lookup(text, text, text, text) from public;
revoke all on function public.organizer_get_dashboard(text) from public;
revoke all on function public.organizer_create_event(text, text, date, text) from public;
revoke all on function public.organizer_create_category(text, uuid, text, integer, text, jsonb) from public;
revoke all on function public.organizer_delete_category(text, uuid) from public;
revoke all on function public.verify_admin_secret(text, text) from public;
revoke all on function public.admin_list_organizations(text, text) from public;
revoke all on function public.admin_set_organization_status(text, uuid, text, text) from public;
revoke all on function public.admin_regenerate_edit_key(text, uuid, text, text) from public;

grant execute on function public.create_organization(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.verify_edit_key(text, text) to anon, authenticated;
grant execute on function public.get_public_org_info(text) to anon, authenticated;
grant execute on function public.lookup(text, text, text, text) to anon, authenticated;
grant execute on function public.organizer_get_dashboard(text) to anon, authenticated;
grant execute on function public.organizer_create_event(text, text, date, text) to anon, authenticated;
grant execute on function public.organizer_create_category(text, uuid, text, integer, text, jsonb) to anon, authenticated;
grant execute on function public.organizer_delete_category(text, uuid) to anon, authenticated;
grant execute on function public.verify_admin_secret(text, text) to anon, authenticated;
grant execute on function public.admin_list_organizations(text, text) to anon, authenticated;
grant execute on function public.admin_set_organization_status(text, uuid, text, text) to anon, authenticated;
grant execute on function public.admin_regenerate_edit_key(text, uuid, text, text) to anon, authenticated;
