-- ════════════════════════════════════════════════════════════════════
-- DEBTREX SOLUTIONS — INTERNAL SYSTEM DATABASE SCHEMA
-- Run this in Supabase SQL Editor (one block at a time, or all at once)
-- ════════════════════════════════════════════════════════════════════

-- ─── EXTENSIONS ───
create extension if not exists "uuid-ossp";

-- ─── 1. PROFILES (USERS) ───
create table if not exists profiles (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  password_hash text not null,
  full_name text not null,
  role text not null default 'employee'
    check (role in ('ceo', 'owner', 'co-owner', 'manager', 'employee', 'accountant', 'viewer')),
  avatar_url text,
  phone text,
  google_drive_folder_id text,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at timestamptz,
  is_active boolean default true,
  notification_preferences jsonb default '{
    "task_assigned": true,
    "task_deadline": true,
    "task_overdue": true,
    "calendar_invite": true,
    "expense_status": true,
    "weekly_digest": true
  }'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profiles_email_idx on profiles(email);
create index if not exists profiles_role_idx on profiles(role);

-- ─── 2. TASKS ───
create table if not exists tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  created_by uuid references profiles(id) not null,
  assigned_to uuid references profiles(id) not null,
  status text default 'not_started'
    check (status in ('not_started', 'in_progress', 'submitted', 'completed', 'overdue', 'cancelled')),
  priority text default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  deadline timestamptz,
  estimated_days integer,
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tasks_assigned_to_idx on tasks(assigned_to);
create index if not exists tasks_created_by_idx on tasks(created_by);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_deadline_idx on tasks(deadline);

-- ─── 3. TASK UPDATES (work log) ───
create table if not exists task_updates (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references tasks(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  update_text text not null,
  hours_worked numeric(5,2),
  status_change text,
  attached_files jsonb,
  created_at timestamptz default now()
);

create index if not exists task_updates_task_id_idx on task_updates(task_id);

-- ─── 4. TASK NOTES ───
create table if not exists task_notes (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references tasks(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  note text not null,
  created_at timestamptz default now()
);

-- ─── 5. CALENDAR EVENTS ───
create table if not exists events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean default false,
  created_by uuid references profiles(id) not null,
  category text default 'meeting'
    check (category in ('meeting', 'training', 'deadline', 'holiday', 'personal', 'other')),
  color text default '#E02020',
  visibility text default 'team'
    check (visibility in ('private', 'team', 'company')),
  recurring_pattern text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists events_start_time_idx on events(start_time);

-- ─── 6. EVENT ATTENDEES ───
create table if not exists event_attendees (
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text default 'invited'
    check (status in ('invited', 'accepted', 'declined', 'tentative')),
  primary key (event_id, user_id)
);

-- ─── 7. BUDGETS (monthly allocations) ───
create table if not exists budgets (
  id uuid default uuid_generate_v4() primary key,
  month date not null,
  category text not null,
  allocated_amount numeric(12,2) not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (month, category)
);

create index if not exists budgets_month_idx on budgets(month);

-- ─── 8. EXPENSES ───
create table if not exists expenses (
  id uuid default uuid_generate_v4() primary key,
  amount numeric(12,2) not null,
  category text not null,
  description text not null,
  vendor text,
  paid_by uuid references profiles(id) not null,
  payment_method text
    check (payment_method in ('card', 'wire', 'check', 'cash', 'other')),
  receipt_drive_id text,
  expense_date date not null,
  status text default 'submitted'
    check (status in ('submitted', 'approved', 'rejected', 'reimbursed')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists expenses_paid_by_idx on expenses(paid_by);
create index if not exists expenses_status_idx on expenses(status);
create index if not exists expenses_date_idx on expenses(expense_date);

-- ─── 9. INCOME ───
create table if not exists income (
  id uuid default uuid_generate_v4() primary key,
  amount numeric(12,2) not null,
  source text not null,
  category text,
  received_date date not null,
  recorded_by uuid references profiles(id),
  notes text,
  created_at timestamptz default now()
);

create index if not exists income_date_idx on income(received_date);

-- ─── 10. AUDIT LOG ───
create table if not exists audit_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id),
  action text not null,
  resource_type text,
  resource_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists audit_log_user_id_idx on audit_log(user_id);
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);

-- ─── 11. NOTIFICATIONS (in-app) ───
create table if not exists notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id, is_read);

-- ─── HELPER FUNCTION: AUTO-UPDATE updated_at ───
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on profiles
  for each row execute function update_updated_at_column();
create trigger update_tasks_updated_at before update on tasks
  for each row execute function update_updated_at_column();
create trigger update_events_updated_at before update on events
  for each row execute function update_updated_at_column();

-- ─── INITIAL CEO USER ───
-- After running this schema, create your first CEO account by calling:
-- POST /api/auth/setup with { email, password, full_name }
-- This endpoint only works when there are 0 users in the system.

-- ─── DONE ───
-- Your database is ready! Verify by running: select * from profiles;
