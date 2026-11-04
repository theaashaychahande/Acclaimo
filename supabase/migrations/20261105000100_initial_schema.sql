-- Core tables for organizations, events, categories, and participant hashes.
-- Participants are stored only as salted hashes, never as plain names.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  link_id text not null unique,
  name text not null,
  department_or_club text not null,
  public_contact text,
  logo_path text,
  salt text not null,
  edit_key_hash text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint organizations_link_id_format check (link_id ~ '^[a-z2-7]{10}$'),
  constraint organizations_name_length check (char_length(name) between 1 and 120),
  constraint organizations_department_length check (char_length(department_or_club) between 1 and 120),
  constraint organizations_contact_length check (public_contact is null or char_length(public_contact) <= 200),
  constraint organizations_logo_length check (logo_path is null or char_length(logo_path) <= 300),
  constraint organizations_salt_format check (salt ~ '^[0-9a-f]{32}$'),
  constraint organizations_edit_key_hash_format check (edit_key_hash ~ '^[0-9a-f]{64}$'),
  constraint organizations_status_values check (status in ('active', 'disabled'))
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  date date not null,
  description text,
  status text not null default 'draft',
  expiry_date date,
  default_category_id uuid,
  searches bigint not null default 0,
  downloads bigint not null default 0,
  not_found bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint events_name_length check (char_length(name) between 1 and 120),
  constraint events_description_length check (description is null or char_length(description) <= 2000),
  constraint events_status_values check (status in ('draft', 'live', 'paused', 'expired')),
  constraint events_expiry_after_date check (expiry_date is null or expiry_date >= date),
  constraint events_id_organization_key unique (id, organization_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  template_path text,
  design_settings jsonb not null default '{}'::jsonb,
  downloads bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_label_length check (char_length(label) between 1 and 40),
  constraint categories_sort_order_range check (sort_order between 0 and 5),
  constraint categories_template_path_length check (template_path is null or char_length(template_path) <= 300),
  constraint categories_design_settings_object check (jsonb_typeof(design_settings) = 'object'),
  constraint categories_id_event_key unique (id, event_id)
);

create unique index categories_event_label_key on public.categories (event_id, lower(label));

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  category_id uuid not null,
  name_hash text not null,
  duplicate_flag boolean not null default false,
  identifier_hash text,
  extra_text text,
  alias_of uuid,
  created_at timestamptz not null default now(),
  constraint participants_name_hash_format check (name_hash ~ '^[0-9a-f]{64}$'),
  constraint participants_identifier_hash_format check (
    identifier_hash is null or identifier_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint participants_extra_text_length check (extra_text is null or char_length(extra_text) <= 60),
  constraint participants_duplicate_identifier check (
    (duplicate_flag and identifier_hash is not null)
    or (not duplicate_flag and identifier_hash is null)
  ),
  constraint participants_id_event_key unique (id, event_id),
  constraint participants_category_fk foreign key (category_id, event_id)
    references public.categories (id, event_id)
    on delete no action deferrable initially deferred,
  constraint participants_alias_fk foreign key (alias_of, event_id)
    references public.participants (id, event_id)
    on delete cascade
);

create unique index participants_event_name_key
  on public.participants (event_id, name_hash, identifier_hash) nulls not distinct;

-- The event's default category must belong to that same event. Deferred so an
-- event and all of its categories can be removed in one transaction.
alter table public.events
  add constraint events_default_category_fk
  foreign key (default_category_id, id)
  references public.categories (id, event_id)
  on delete no action
  deferrable initially deferred;

create table public.admin_config (
  id boolean primary key default true,
  secret_hash text not null,
  updated_at timestamptz not null default now(),
  constraint admin_config_single_row check (id),
  constraint admin_config_secret_hash_format check (secret_hash ~ '^[0-9a-f]{64}$')
);

create table public.rate_limits (
  id bigserial primary key,
  bucket text not null,
  subject_hash text not null,
  organization_id uuid references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint rate_limits_bucket_length check (char_length(bucket) between 1 and 40),
  constraint rate_limits_subject_format check (subject_hash ~ '^[0-9a-f]{64}$')
);

create index rate_limits_lookup_idx
  on public.rate_limits (bucket, subject_hash, organization_id, created_at desc);

create table public.lookup_streaks (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subject_hash text not null,
  strikes smallint not null default 0,
  last_not_found_at timestamptz not null default now(),
  primary key (organization_id, subject_hash),
  constraint lookup_streaks_strikes_range check (strikes between 0 and 8),
  constraint lookup_streaks_subject_format check (subject_hash ~ '^[0-9a-f]{64}$')
);

create index events_organization_status_idx
  on public.events (organization_id, status, expiry_date);

create index participants_event_name_hash_idx
  on public.participants (event_id, name_hash);

create index participants_category_idx on public.participants (category_id);

-- Maximum of six categories per event.
create function public.enforce_category_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.categories where event_id = new.event_id) >= 6 then
    raise exception 'category_limit_reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger categories_limit_before_insert
  before insert on public.categories
  for each row execute function public.enforce_category_limit();

create trigger categories_limit_before_move
  before update of event_id on public.categories
  for each row execute function public.enforce_category_limit();

-- Maximum of 5,000 participants per event. Checked per statement so a batch
-- insert does not rescan the table once per row.
create function public.enforce_participant_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  changed_event uuid;
begin
  for changed_event in select distinct event_id from new_participants loop
    if (select count(*) from public.participants where event_id = changed_event) > 5000 then
      raise exception 'participant_limit_reached' using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end;
$$;

create trigger participants_limit_after_insert
  after insert on public.participants
  referencing new table as new_participants
  for each statement execute function public.enforce_participant_limit();

-- Direct table access is closed to the public. Security-definer functions and
-- the service role are the only paths in.
alter table public.organizations enable row level security;
alter table public.events enable row level security;
alter table public.categories enable row level security;
alter table public.participants enable row level security;
alter table public.admin_config enable row level security;
alter table public.rate_limits enable row level security;
alter table public.lookup_streaks enable row level security;

revoke all on public.organizations from public, anon, authenticated;
revoke all on public.events from public, anon, authenticated;
revoke all on public.categories from public, anon, authenticated;
revoke all on public.participants from public, anon, authenticated;
revoke all on public.admin_config from public, anon, authenticated;
revoke all on public.rate_limits from public, anon, authenticated;
revoke all on public.lookup_streaks from public, anon, authenticated;
revoke all on sequence public.rate_limits_id_seq from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
