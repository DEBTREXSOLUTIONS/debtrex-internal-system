-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 013 — Leads (fast data-entry + Forth-CRM-style list)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A lightweight, high-volume leads table separate from pipeline_contacts.
-- Built for entering thousands of leads quickly and browsing them in a
-- dense, paginated table. Each lead is either a CLIENT lead or a
-- BUSINESS lead.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. LEADS TABLE ───
create table if not exists leads (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  email text,
  website text,
  lead_type text not null default 'client' check (lead_type in ('client', 'business')),
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'dead')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes — keep list + filter fast as the table grows into the thousands
create index if not exists leads_created_at_idx on leads(created_at desc);
create index if not exists leads_type_idx on leads(lead_type);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_created_by_idx on leads(created_by);

create trigger update_leads_updated_at before update on leads
  for each row execute function update_updated_at_column();

-- ─── 2. SEED PERMISSION KEYS ───
-- Keys kept in sync with lib/permissions.ts
do $$
declare
  r text;
  k text;
  new_keys text[] := array[
    'section.leads', 'leads.create', 'leads.edit', 'leads.delete', 'leads.export'
  ];
begin
  -- Leadership: everything on
  foreach r in array array['ceo', 'owner', 'co-owner'] loop
    foreach k in array new_keys loop
      perform seed_permission(r, k, true);
    end loop;
  end loop;

  -- Manager: full access too
  foreach k in array new_keys loop
    perform seed_permission('manager', k, true);
  end loop;

  -- Employee: can see the section and add/edit leads, but not delete or export
  perform seed_permission('employee', 'section.leads', true);
  perform seed_permission('employee', 'leads.create', true);
  perform seed_permission('employee', 'leads.edit', true);
  perform seed_permission('employee', 'leads.delete', false);
  perform seed_permission('employee', 'leads.export', false);

  -- Accountant / viewer: explicit denies (deny-by-default already covers
  -- this, but rows make the checkbox visible in the permissions UI)
  foreach r in array array['accountant', 'viewer'] loop
    foreach k in array new_keys loop
      perform seed_permission(r, k, false);
    end loop;
  end loop;
end$$;
