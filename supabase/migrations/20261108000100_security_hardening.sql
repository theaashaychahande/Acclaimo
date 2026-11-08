-- Security hardening: trustworthy rate-limit identity, failure-only login
-- limits, bounded tracking tables, and private-by-default functions.

-- Cloudflare overwrites cf-connecting-ip at the edge. Fall back to the last
-- x-forwarded-for hop (appended by the proxy), never the client's first value.
create or replace function public.request_ip()
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_headers jsonb;
  v_forwarded text;
  v_last_hop text;
begin
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_forwarded := v_headers ->> 'x-forwarded-for';
  if v_forwarded is not null and btrim(v_forwarded) <> '' then
    v_last_hop := btrim(split_part(
      v_forwarded,
      ',',
      array_length(string_to_array(v_forwarded, ','), 1)
    ));
  end if;

  return coalesce(
    nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    nullif(v_last_hop, ''),
    'unknown'
  );
end;
$$;

-- A valid edit-key hash is the credential, so only failed logins count. This
-- keeps a busy organizer from locking themselves out while still slowing down
-- guessing. The IP bucket is a backstop when the device id is rotated.
create or replace function public.verify_edit_key(
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
  v_ip_subject text;
  v_limit jsonb;
  v_ip_limit jsonb;
  v_retry integer;
  v_org public.organizations%rowtype;
begin
  if p_edit_key_hash is null or p_edit_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_edit_key_hash' using errcode = '22023';
  end if;

  select *
    into v_org
    from public.organizations
   where edit_key_hash = p_edit_key_hash
     and status = 'active';

  if found then
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
  end if;

  v_subject := public.actor_hash(p_device_id);
  v_ip_subject := public.actor_hash(null);

  v_limit := public.consume_rate_limit('login', v_subject, null, 5, interval '15 minutes');
  v_ip_limit := public.consume_rate_limit('login_ip', v_ip_subject, null, 40, interval '15 minutes');

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

  return jsonb_build_object('status', 'invalid_key');
end;
$$;

-- Organization creation now has an IP backstop as well as the device limit.
-- The device id is a convenience, not an identity, so it can be cleared.
create or replace function public.create_organization(
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
  v_ip_subject text;
  v_limit jsonb;
  v_ip_limit jsonb;
  v_retry integer;
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
  v_ip_subject := public.actor_hash(null);

  v_limit := public.consume_rate_limit('create_org', v_subject, null, 3, interval '1 hour');
  v_ip_limit := public.consume_rate_limit('create_org_ip', v_ip_subject, null, 10, interval '1 hour');

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

-- Retention also trims the rate-limit and lookup-strike tables, which would
-- otherwise grow with every random device id an abuser sends.
create or replace function public.cleanup_expired(p_retention_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff date;
  v_events integer;
  v_limits integer;
  v_streaks integer;
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

  delete from public.rate_limits
   where created_at < now() - interval '1 day';
  get diagnostics v_limits = row_count;

  delete from public.lookup_streaks
   where last_not_found_at < now() - interval '30 days';
  get diagnostics v_streaks = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'events_removed', v_events,
    'rate_limits_removed', v_limits,
    'lookup_streaks_removed', v_streaks
  );
end;
$$;

create index if not exists rate_limits_created_at_idx
  on public.rate_limits (created_at);

create index if not exists lookup_streaks_last_not_found_idx
  on public.lookup_streaks (last_not_found_at);

-- Nothing in the app calls this wrapper, so keep it off the public API.
revoke execute on function public.verify_admin_secret(text, text) from anon, authenticated;

-- New functions in this schema must be granted explicitly, not inherited from
-- PUBLIC. This closes the most common way a future helper becomes callable.
alter default privileges in schema public
  revoke all on functions from public, anon, authenticated;
