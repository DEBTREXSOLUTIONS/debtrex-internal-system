-- ════════════════════════════════════════════════════════════════════
-- DEBTREX MIGRATION 009 — Scripts (Sales / Openers / etc.)
-- ════════════════════════════════════════════════════════════════════
-- A simple scripts library:
--   script_sections  — top-level buckets (Sales, Openers, ...)
--   scripts          — individual scripts under a section, each of one
--                      kind: verbatim | objections | rebuttals
--   script_tags      — taggable labels managed by admins
--   script_tag_links — m:n join between scripts and tags
--
-- Page is gated by `section.scripts` (visibility) and modification is
-- gated by `scripts.manage` / `scripts.manage_tags`.
-- ════════════════════════════════════════════════════════════════════

-- ─── 0. ENSURE HELPER FUNCTION EXISTS (idempotent) ───
create or replace function seed_permission(p_role text, p_key text, p_enabled boolean)
returns void as $$
begin
  insert into role_permissions (role, permission_key, enabled)
  values (p_role, p_key, p_enabled)
  on conflict (role, permission_key) do nothing;
end;
$$ language plpgsql;


-- ─── 1. SECTIONS ───
create table if not exists script_sections (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  sort_order integer default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (name)
);

create index if not exists script_sections_sort_idx on script_sections(sort_order, name);

create trigger update_script_sections_updated_at before update on script_sections
  for each row execute function update_updated_at_column();


-- ─── 2. SCRIPTS ───
-- A script always belongs to ONE section and is exactly ONE kind.
create table if not exists scripts (
  id uuid default uuid_generate_v4() primary key,
  section_id uuid references script_sections(id) on delete cascade not null,
  kind text not null check (kind in ('verbatim', 'objections', 'rebuttals')),
  title text not null,
  body text not null,
  sort_order integer default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists scripts_section_idx on scripts(section_id, kind, sort_order);
create index if not exists scripts_kind_idx    on scripts(kind);

create trigger update_scripts_updated_at before update on scripts
  for each row execute function update_updated_at_column();


-- ─── 3. TAGS ───
create table if not exists script_tags (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text default 'gray',   -- 'red' | 'blue' | 'green' | 'yellow' | 'gray'
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (name)
);


-- ─── 4. SCRIPT ↔ TAG (m:n) ───
create table if not exists script_tag_links (
  script_id uuid references scripts(id)     on delete cascade not null,
  tag_id    uuid references script_tags(id) on delete cascade not null,
  primary key (script_id, tag_id)
);

create index if not exists script_tag_links_tag_idx on script_tag_links(tag_id);


-- ─── 5. PERMISSIONS ───
-- section.scripts      → see the Scripts sidebar item / page
-- scripts.manage       → create/edit/delete sections + scripts
-- scripts.manage_tags  → create/edit/delete tags + assign tags to scripts
do $$
begin
  -- View access: everyone except viewer by default
  perform seed_permission('ceo',        'section.scripts', true);
  perform seed_permission('owner',      'section.scripts', true);
  perform seed_permission('co-owner',   'section.scripts', true);
  perform seed_permission('manager',    'section.scripts', true);
  perform seed_permission('employee',   'section.scripts', true);
  perform seed_permission('accountant', 'section.scripts', false);
  perform seed_permission('viewer',     'section.scripts', false);

  -- Manage scripts/sections: admin-level only
  perform seed_permission('ceo',        'scripts.manage', true);
  perform seed_permission('owner',      'scripts.manage', true);
  perform seed_permission('co-owner',   'scripts.manage', true);
  perform seed_permission('manager',    'scripts.manage', true);
  perform seed_permission('employee',   'scripts.manage', false);
  perform seed_permission('accountant', 'scripts.manage', false);
  perform seed_permission('viewer',     'scripts.manage', false);

  -- Manage tags: admin-level only
  perform seed_permission('ceo',        'scripts.manage_tags', true);
  perform seed_permission('owner',      'scripts.manage_tags', true);
  perform seed_permission('co-owner',   'scripts.manage_tags', true);
  perform seed_permission('manager',    'scripts.manage_tags', true);
  perform seed_permission('employee',   'scripts.manage_tags', false);
  perform seed_permission('accountant', 'scripts.manage_tags', false);
  perform seed_permission('viewer',     'scripts.manage_tags', false);
end$$;


-- ─── DONE ───
-- Verify:
--   select * from script_sections;
--   select * from scripts;
--   select * from script_tags;
--   select role, permission_key, enabled from role_permissions
--    where permission_key in ('section.scripts', 'scripts.manage', 'scripts.manage_tags')
--    order by role, permission_key;
