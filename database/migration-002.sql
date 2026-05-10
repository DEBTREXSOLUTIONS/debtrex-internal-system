-- ════════════════════════════════════════════════════════════════════
-- DEBTREX MIGRATION 002 — Performance Tracking + Calculators
-- Run in Supabase SQL Editor (paste all, click Run)
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. MANAGER-AGENT ASSIGNMENTS (many-to-many) ───
-- A manager can oversee multiple agents; an agent can report to multiple managers.
-- Only CEO/Owner/Co-Owner can create/delete these assignments.
create table if not exists manager_assignments (
  id uuid default uuid_generate_v4() primary key,
  manager_id uuid references profiles(id) on delete cascade not null,
  agent_id uuid references profiles(id) on delete cascade not null,
  assigned_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (manager_id, agent_id)
);

create index if not exists manager_assignments_manager_idx on manager_assignments(manager_id);
create index if not exists manager_assignments_agent_idx on manager_assignments(agent_id);

-- ─── 2. CLIENT CALCULATIONS (DTI + Budget calculator history) ───
create table if not exists client_calculations (
  id uuid default uuid_generate_v4() primary key,
  -- Who created this record
  created_by uuid references profiles(id) not null,
  -- Client info
  client_name text not null,
  client_email text,
  client_phone text,
  -- Calculation type
  calculation_type text not null check (calculation_type in ('dti', 'budget', 'both')),
  -- DTI inputs/outputs (all optional so we can do partial)
  monthly_gross_income numeric(12,2),
  monthly_debt_payments numeric(12,2),
  dti_ratio numeric(5,2), -- percentage 0-100+
  dti_category text, -- 'excellent' | 'good' | 'concerning' | 'high' | 'critical'
  -- Budget inputs/outputs
  monthly_net_income numeric(12,2),
  total_monthly_expenses numeric(12,2),
  monthly_disposable_income numeric(12,2),
  expense_breakdown jsonb, -- { housing: 1500, utilities: 200, ... }
  debt_breakdown jsonb,    -- { credit_cards: 5000, loans: 12000, ... }
  total_debt numeric(12,2),
  -- Program recommendation
  recommended_program text,
  estimated_monthly_payment numeric(12,2),
  estimated_savings numeric(12,2),
  -- Notes
  notes text,
  -- Status to mark whether this prospect was enrolled
  enrollment_status text default 'prospect' check (enrollment_status in ('prospect', 'qualified', 'enrolled', 'declined', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists client_calculations_created_by_idx on client_calculations(created_by);
create index if not exists client_calculations_status_idx on client_calculations(enrollment_status);
create index if not exists client_calculations_created_at_idx on client_calculations(created_at desc);

-- Auto-update updated_at
create trigger update_client_calculations_updated_at before update on client_calculations
  for each row execute function update_updated_at_column();

-- ─── DONE ───
-- Verify with:
--   select * from manager_assignments;
--   select * from client_calculations;
