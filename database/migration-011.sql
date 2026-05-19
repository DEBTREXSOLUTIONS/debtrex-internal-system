-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 011 — Transfer Protocol + Status enforcement + Calls tracker
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds:
--   1. status_locked flag on profiles — auto-set when an agent is on a call,
--      blocks manual status changes. Only admins can clear.
--   2. extension column on profiles — short internal dial code (e.g. "101").
--   3. internal_contacts — directory of internal/external numbers an agent
--      can transfer customers to. May or may not be tied to a profile.
--   4. call_queues + call_queue_members — inbound routing queues with
--      ring-strategy.
--   5. New permission keys: call.transfer, transfer.manage,
--      team.manage_status, calls.view_stats.
--   6. queue routing mode on phone_number_routing.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. profiles: status_locked + extension ───
alter table profiles
  add column if not exists status_locked boolean not null default false,
  add column if not exists extension text;

create unique index if not exists profiles_extension_unique
  on profiles(extension)
  where extension is not null;

-- ─── 2. internal_contacts ───
-- Each row is something an agent can transfer a customer TO.
--   - profile_id non-null → this is an internal teammate (extension may be
--     redundant with profiles.extension; we mirror it here for the directory).
--   - profile_id null     → external contact (vendor, partner, hotline).
create table if not exists internal_contacts (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,                                  -- E.164 for external; optional for internal
  extension text,                              -- internal dial code (optional)
  profile_id uuid references profiles(id) on delete set null,
  department text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists internal_contacts_name_idx
  on internal_contacts(lower(name));
create index if not exists internal_contacts_extension_idx
  on internal_contacts(extension);
create index if not exists internal_contacts_profile_idx
  on internal_contacts(profile_id);

create trigger update_internal_contacts_updated_at
  before update on internal_contacts
  for each row execute function update_updated_at_column();

-- ─── 3. call_queues ───
create table if not exists call_queues (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  -- ring strategy:
  --   'round_robin' — rotate through members in order
  --   'all_ring'    — ring every member, first to answer wins
  --   'longest_idle' — pick the member who hasn't taken a call the longest
  strategy text not null default 'all_ring'
    check (strategy in ('round_robin', 'all_ring', 'longest_idle')),
  ring_timeout_seconds integer not null default 20,
  max_wait_seconds integer not null default 300,
  hold_music_url text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger update_call_queues_updated_at
  before update on call_queues
  for each row execute function update_updated_at_column();

create table if not exists call_queue_members (
  queue_id uuid references call_queues(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  priority integer not null default 0,
  added_at timestamptz default now(),
  primary key (queue_id, profile_id)
);

create index if not exists call_queue_members_profile_idx
  on call_queue_members(profile_id);

-- ─── 4. phone_number_routing: allow 'queue' mode ───
alter table phone_number_routing
  drop constraint if exists phone_number_routing_routing_mode_check;
alter table phone_number_routing
  add constraint phone_number_routing_routing_mode_check
  check (routing_mode in ('agent', 'available', 'voicemail', 'queue'));

alter table phone_number_routing
  add column if not exists queue_id uuid references call_queues(id) on delete set null;

-- ─── 5. Seed new permission keys for built-in roles ───
do $$
declare
  r text;
  new_keys text[] := array['call.transfer', 'transfer.manage', 'team.manage_status', 'calls.view_stats'];
  k text;
begin
  -- Leadership roles get everything new
  foreach r in array array['ceo', 'owner', 'co-owner'] loop
    foreach k in array new_keys loop
      perform seed_permission(r, k, true);
    end loop;
  end loop;

  -- Manager: can transfer, manage_status, view_stats, but not edit transfer config
  foreach k in array array['call.transfer', 'team.manage_status', 'calls.view_stats'] loop
    perform seed_permission('manager', k, true);
  end loop;
  perform seed_permission('manager', 'transfer.manage', false);

  -- Employee / accountant / viewer: explicit denies (deny-by-default already
  -- handles this, but rows make the UI checkbox visible).
  foreach r in array array['employee', 'accountant', 'viewer'] loop
    foreach k in array new_keys loop
      perform seed_permission(r, k, false);
    end loop;
  end loop;

  -- Employees can transfer calls they're on
  perform seed_permission('employee', 'call.transfer', true);
end$$;
