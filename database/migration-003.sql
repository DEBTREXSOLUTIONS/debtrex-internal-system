-- ════════════════════════════════════════════════════════════════════
-- DEBTREX MIGRATION 003 — Pipeline + Granular Permissions + Twilio
-- Run in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. PIPELINE CONTACTS (Management + Sales unified) ───
-- Type: 'management' = companies to make deals with (B2B)
-- Type: 'sales' = leads for the debt relief program (B2C)
create table if not exists pipeline_contacts (
  id uuid default uuid_generate_v4() primary key,
  -- Type
  pipeline_type text not null check (pipeline_type in ('management', 'sales')),
  -- Common
  full_name text not null,
  company_name text,            -- main field for management; optional for sales
  email text,
  phone text,
  alternative_phone text,
  address text,
  city text,
  state text,
  zip text,
  -- Sales-specific
  estimated_debt numeric(12,2),
  monthly_income numeric(12,2),
  dti_ratio numeric(5,2),
  -- Management-specific
  industry text,
  company_size text,            -- 'small' | 'medium' | 'large' | 'enterprise'
  deal_value numeric(12,2),
  -- Status (different sets per pipeline type, but stored as text)
  status text not null default 'new',
  -- Ownership
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id) not null,
  -- Source
  source text,                  -- 'website' | 'referral' | 'cold_call' | 'ad' | etc
  -- Notes (general - separate from call logs)
  notes text,
  tags text[],
  -- Timing
  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  contract_signed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists pipeline_contacts_type_idx on pipeline_contacts(pipeline_type);
create index if not exists pipeline_contacts_status_idx on pipeline_contacts(status);
create index if not exists pipeline_contacts_assigned_idx on pipeline_contacts(assigned_to);
create index if not exists pipeline_contacts_followup_idx on pipeline_contacts(next_followup_at);

create trigger update_pipeline_contacts_updated_at before update on pipeline_contacts
  for each row execute function update_updated_at_column();

-- ─── 2. CALL LOGS ───
-- Every call attempt — Twilio or manual — gets logged here
create table if not exists call_logs (
  id uuid default uuid_generate_v4() primary key,
  contact_id uuid references pipeline_contacts(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  -- Call details
  direction text not null check (direction in ('outbound', 'inbound')),
  outcome text not null check (outcome in (
    'connected', 'voicemail', 'no_answer', 'busy', 'wrong_number',
    'scheduled_callback', 'not_interested', 'sale_closed', 'follow_up'
  )),
  duration_seconds integer,
  notes text,
  -- Twilio integration fields (optional)
  twilio_call_sid text,
  twilio_recording_url text,
  twilio_recording_duration integer,
  -- Timing
  called_at timestamptz default now() not null
);

create index if not exists call_logs_contact_idx on call_logs(contact_id, called_at desc);
create index if not exists call_logs_user_idx on call_logs(user_id, called_at desc);

-- ─── 3. CONTACT NOTES (separate from call notes - stickies/observations) ───
create table if not exists contact_notes (
  id uuid default uuid_generate_v4() primary key,
  contact_id uuid references pipeline_contacts(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  note text not null,
  is_pinned boolean default false,
  created_at timestamptz default now()
);

create index if not exists contact_notes_contact_idx on contact_notes(contact_id, created_at desc);

-- ─── 4. ROLE PERMISSIONS (granular, CEO-controllable) ───
-- Each row is one permission for one role. Defaults are seeded below.
-- CEO can toggle any of these on/off via the Permissions UI.
create table if not exists role_permissions (
  id uuid default uuid_generate_v4() primary key,
  role text not null,
  permission_key text not null,
  enabled boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now(),
  unique (role, permission_key)
);

create index if not exists role_permissions_role_idx on role_permissions(role);

create trigger update_role_permissions_updated_at before update on role_permissions
  for each row execute function update_updated_at_column();

-- ─── 5. SEED DEFAULT PERMISSIONS ───
-- These are the starter defaults. CEO can change any of them later via the UI.
-- Permission keys are namespaced by feature: section.action

-- Helper: insert a row only if not exists
create or replace function seed_permission(p_role text, p_key text, p_enabled boolean)
returns void as $$
begin
  insert into role_permissions (role, permission_key, enabled)
  values (p_role, p_key, p_enabled)
  on conflict (role, permission_key) do nothing;
end;
$$ language plpgsql;

-- All permission keys (kept in sync with lib/permissions.ts)
do $$
declare
  perm_keys text[] := array[
    -- Sections (visibility)
    'section.dashboard', 'section.tasks', 'section.calendar',
    'section.files', 'section.budget', 'section.team',
    'section.performance', 'section.calculators',
    'section.pipeline_management', 'section.pipeline_sales',
    -- Tasks
    'task.create', 'task.edit_any', 'task.delete', 'task.assign_to_anyone',
    'task.view_all',
    -- Calendar
    'event.create', 'event.edit_any', 'event.delete', 'event.invite_anyone',
    -- Budget
    'budget.view', 'budget.edit_allocations',
    'expense.submit', 'expense.approve',
    'income.record',
    -- Team
    'team.invite', 'team.change_roles', 'team.deactivate', 'team.delete',
    -- Performance
    'performance.view_all', 'performance.view_team', 'performance.assign_managers',
    -- Pipeline (management + sales)
    'pipeline.create', 'pipeline.edit_any', 'pipeline.delete',
    'pipeline.view_all', 'pipeline.assign_to_anyone',
    'pipeline.export',
    -- Calls
    'call.log', 'call.make', 'call.view_all',
    -- Permissions
    'permissions.manage'
  ];
  k text;
  r text;
  rs text[] := array['ceo', 'owner', 'co-owner', 'manager', 'employee', 'accountant', 'viewer'];
begin
  -- CEO and Owner: everything ON by default
  foreach k in array perm_keys loop
    perform seed_permission('ceo', k, true);
    perform seed_permission('owner', k, true);
  end loop;

  -- Co-Owner: everything except deleting top-level accounts
  foreach k in array perm_keys loop
    if k = 'team.delete' then
      perform seed_permission('co-owner', k, false);
    else
      perform seed_permission('co-owner', k, true);
    end if;
  end loop;

  -- Manager: most things, but not budget edit, not team management, not permissions
  foreach k in array perm_keys loop
    if k like 'section.%' or k like 'task.%' or k like 'event.%'
       or k like 'pipeline.%' or k like 'call.%'
       or k = 'expense.submit' or k = 'performance.view_team' then
      perform seed_permission('manager', k, true);
    else
      perform seed_permission('manager', k, false);
    end if;
  end loop;
  -- Override: managers DO see budget (their team's), and use calculators
  perform seed_permission('manager', 'section.budget', false);
  perform seed_permission('manager', 'budget.view', false);
  perform seed_permission('manager', 'section.calculators', true);

  -- Employee: basic access
  foreach k in array perm_keys loop
    perform seed_permission('employee', k, false);
  end loop;
  perform seed_permission('employee', 'section.dashboard', true);
  perform seed_permission('employee', 'section.tasks', true);
  perform seed_permission('employee', 'task.create', true);
  perform seed_permission('employee', 'section.calendar', true);
  perform seed_permission('employee', 'event.create', true);
  perform seed_permission('employee', 'section.files', true);
  perform seed_permission('employee', 'section.calculators', true);
  perform seed_permission('employee', 'section.pipeline_sales', true);
  perform seed_permission('employee', 'pipeline.create', true);
  perform seed_permission('employee', 'expense.submit', true);
  perform seed_permission('employee', 'call.log', true);
  perform seed_permission('employee', 'call.make', true);

  -- Accountant: budget focused
  foreach k in array perm_keys loop
    perform seed_permission('accountant', k, false);
  end loop;
  perform seed_permission('accountant', 'section.dashboard', true);
  perform seed_permission('accountant', 'section.budget', true);
  perform seed_permission('accountant', 'budget.view', true);
  perform seed_permission('accountant', 'budget.edit_allocations', true);
  perform seed_permission('accountant', 'expense.approve', true);
  perform seed_permission('accountant', 'expense.submit', true);
  perform seed_permission('accountant', 'income.record', true);
  perform seed_permission('accountant', 'section.calendar', true);
  perform seed_permission('accountant', 'section.tasks', true);

  -- Viewer: read-only basics
  foreach k in array perm_keys loop
    perform seed_permission('viewer', k, false);
  end loop;
  perform seed_permission('viewer', 'section.dashboard', true);
  perform seed_permission('viewer', 'section.tasks', true);
  perform seed_permission('viewer', 'section.calendar', true);
end $$;

-- Drop the helper (not needed permanently)
drop function if exists seed_permission(text, text, boolean);

-- ─── DONE ───
-- Verify with:
--   select * from pipeline_contacts;
--   select * from call_logs;
--   select * from contact_notes;
--   select role, permission_key, enabled from role_permissions order by role, permission_key;
