-- ════════════════════════════════════════════════════════════════════
-- DEBTREX MIGRATION 008 — Task Requests
-- ════════════════════════════════════════════════════════════════════
-- Adds the ability for non-creator users to *request* a task. The request
-- sits in a pending queue until an admin-level user (CEO / Owner / Manager)
-- approves it — approval creates the real task row in the `tasks` table.
--
-- Manager scope: managers can only see/approve requests where the requester
-- is one of their assigned agents (via `manager_assignments`). CEO + Owner
-- + Co-Owner see all requests.
-- ════════════════════════════════════════════════════════════════════

-- ─── 0. ENSURE HELPER FUNCTION EXISTS ───
-- (used by both migration-003 and migration-008)
create or replace function seed_permission(p_role text, p_key text, p_enabled boolean)
returns void as $$
begin
  insert into role_permissions (role, permission_key, enabled)
  values (p_role, p_key, p_enabled)
  on conflict (role, permission_key) do nothing;
end;
$$ language plpgsql;

-- ─── 1. TASK REQUESTS TABLE ───
create table if not exists task_requests (
  id uuid default uuid_generate_v4() primary key,

  -- The would-be task fields
  title         text not null,
  description   text,
  priority      text default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  deadline      timestamptz,
  estimated_days integer,

  -- Who requested it
  requested_by  uuid references profiles(id) not null,
  -- Who the task would be assigned to if approved (often = requested_by)
  assigned_to   uuid references profiles(id) not null,
  -- Optional: the requester can target a specific admin to review.
  -- If null, ANY eligible admin can act on it.
  target_approver uuid references profiles(id),

  -- Approval state
  status        text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'cancelled')),
  resolved_by   uuid references profiles(id),
  resolved_at   timestamptz,
  denial_reason text,
  -- When approved, the actual task created from this request
  created_task_id uuid references tasks(id) on delete set null,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists task_requests_status_idx       on task_requests(status);
create index if not exists task_requests_requested_by_idx on task_requests(requested_by);
create index if not exists task_requests_target_approver  on task_requests(target_approver);
create index if not exists task_requests_pending_created  on task_requests(created_at desc) where status = 'pending';

create trigger update_task_requests_updated_at before update on task_requests
  for each row execute function update_updated_at_column();


-- ─── 2. SEED PERMISSIONS ───
-- task.request          → can submit a task request
-- task.approve_requests → can see + approve/deny incoming requests
--
-- Defaults:
--   CEO / Owner / Co-Owner / Manager → can approve.
--   Everyone except viewer → can request.
do $$
begin
  -- task.request: most working roles can ask
  perform seed_permission('ceo',        'task.request', true);
  perform seed_permission('owner',      'task.request', true);
  perform seed_permission('co-owner',   'task.request', true);
  perform seed_permission('manager',    'task.request', true);
  perform seed_permission('employee',   'task.request', true);
  perform seed_permission('accountant', 'task.request', true);
  perform seed_permission('viewer',     'task.request', false);

  -- task.approve_requests: admin-level only
  perform seed_permission('ceo',        'task.approve_requests', true);
  perform seed_permission('owner',      'task.approve_requests', true);
  perform seed_permission('co-owner',   'task.approve_requests', true);
  perform seed_permission('manager',    'task.approve_requests', true);
  perform seed_permission('employee',   'task.approve_requests', false);
  perform seed_permission('accountant', 'task.approve_requests', false);
  perform seed_permission('viewer',     'task.approve_requests', false);
end$$;


-- ─── DONE ───
-- Verify:
--   select * from task_requests;
--   select role, permission_key, enabled
--     from role_permissions
--    where permission_key in ('task.request', 'task.approve_requests')
--    order by role, permission_key;
