-- ════════════════════════════════════════════════════════════════════
-- DEBTREX MIGRATION 005 — Custom Roles + Pipeline Collaboration
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. CUSTOM ROLES ───
-- Allow CEO/Owner to create custom roles beyond the built-in ones.
-- Built-in roles (ceo, owner, co-owner, manager, employee, accountant, viewer)
-- continue to work — these are added on top.
create table if not exists custom_roles (
  id uuid default uuid_generate_v4() primary key,
  -- The "value" used in profiles.role and role_permissions.role
  role_key text unique not null,
  -- Display label
  label text not null,
  -- Optional description shown in the admin UI
  description text,
  -- Visual indicator color
  color text default 'gray',
  -- Audit
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  -- Lock built-in roles from edit/delete
  is_built_in boolean default false
);

-- Insert the built-in roles so the UI can show them all in one list
insert into custom_roles (role_key, label, description, is_built_in, color) values
  ('ceo', 'CEO', 'Top leadership, full access', true, 'red'),
  ('owner', 'Owner', 'Co-founder / owner level', true, 'red'),
  ('co-owner', 'Co-Owner', 'Secondary owner', true, 'red'),
  ('manager', 'Manager', 'Team lead, can track assigned agents', true, 'yellow'),
  ('employee', 'Employee', 'Standard sales/operations agent', true, 'blue'),
  ('accountant', 'Accountant', 'Budget and expense management', true, 'green'),
  ('viewer', 'Viewer', 'Read-only access', true, 'gray')
on conflict (role_key) do nothing;

-- Drop the constraint on profiles.role so custom roles can be saved
alter table profiles drop constraint if exists profiles_role_check;

-- Drop the constraint that limits role values
do $$
begin
  if exists (
    select 1 from information_schema.check_constraints
    where constraint_name like '%role%' and constraint_schema = 'public'
  ) then
    null; -- we already dropped above
  end if;
end $$;


-- ─── 2. PIPELINE COLLABORATORS ───
-- Beyond the single `assigned_to` column, allow multiple managers/owners
-- to be added to a contact's pipeline as collaborators (read+edit access)
create table if not exists pipeline_collaborators (
  id uuid default uuid_generate_v4() primary key,
  contact_id uuid references pipeline_contacts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  -- Role on this contact: 'collaborator' (default) | 'observer' (read-only)
  collaboration_role text default 'collaborator' check (collaboration_role in ('collaborator', 'observer')),
  added_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  unique (contact_id, user_id)
);

create index if not exists pipeline_collaborators_contact_idx on pipeline_collaborators(contact_id);
create index if not exists pipeline_collaborators_user_idx on pipeline_collaborators(user_id);


-- ─── 3. ENSURE ROLE_PERMISSIONS WORKS FOR CUSTOM ROLES ───
-- The existing role_permissions table already has no foreign key to a role table,
-- so custom roles automatically work. New custom roles start with all permissions
-- OFF — admin must turn them on via /permissions page.


-- ─── DONE ───
-- Verify:
--   select * from custom_roles;
--   select * from pipeline_collaborators;
