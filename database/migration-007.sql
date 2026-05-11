-- ════════════════════════════════════════════════════════════════════
-- DEBTREX MIGRATION 007 — Agent Status + Inbound Calls
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. AGENT STATUS ───
-- Add status fields to profiles so we know who's online/available/busy
alter table profiles add column if not exists status text
  default 'offline'
  check (status in ('online', 'otl', 'meeting', 'break', 'offline'));

-- Last time the status was changed (used for "stale" detection)
alter table profiles add column if not exists status_updated_at timestamptz default now();

-- Optional custom message ("Back at 3pm", "On a client call", etc.)
alter table profiles add column if not exists status_message text;

-- Index for the "who's online" widget queries
create index if not exists profiles_status_idx on profiles(status) where is_active = true;


-- ─── 2. INBOUND CALL ROUTING ───
-- Twilio doesn't natively support "ring any available agent" without Flex,
-- so we model inbound routing in our DB.

-- Track inbound calls in the same call_logs table — just allow more outcomes
alter table call_logs drop constraint if exists call_logs_outcome_check;
alter table call_logs add constraint call_logs_outcome_check check (outcome in (
  'connected', 'voicemail', 'no_answer', 'busy', 'wrong_number',
  'scheduled_callback', 'not_interested', 'sale_closed', 'follow_up',
  'inbound_missed', 'inbound_answered', 'inbound_voicemail'
));

-- Inbound calls might not have a matching pipeline_contact yet — allow null
alter table call_logs alter column contact_id drop not null;

-- Caller phone number for inbound (when contact_id is null)
alter table call_logs add column if not exists from_number text;
alter table call_logs add column if not exists to_number text;

-- Index for finding recent inbound calls
create index if not exists call_logs_direction_idx on call_logs(direction, called_at desc);


-- ─── 3. PHONE NUMBER ROUTING CONFIG ───
-- Which agent (or fallback) should receive inbound calls to each Twilio number
create table if not exists phone_number_routing (
  id uuid default uuid_generate_v4() primary key,
  twilio_phone_number text unique not null,
  -- Routing mode:
  --   'agent'        - ring a specific agent
  --   'available'    - ring all "online" agents (round-robin)
  --   'voicemail'    - go straight to voicemail
  routing_mode text not null default 'voicemail' check (routing_mode in ('agent', 'available', 'voicemail')),
  -- For 'agent' mode: which agent to ring
  primary_agent_id uuid references profiles(id),
  -- Fallback when nobody answers
  voicemail_message text default 'Thank you for calling DEBTREX Solutions. Please leave a message and we will return your call.',
  -- Ring timeout in seconds before going to voicemail
  ring_timeout_seconds integer default 20,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger update_phone_number_routing_updated_at before update on phone_number_routing
  for each row execute function update_updated_at_column();


-- ─── DONE ───
-- Verify:
--   select id, full_name, status, status_message from profiles;
--   select * from phone_number_routing;
