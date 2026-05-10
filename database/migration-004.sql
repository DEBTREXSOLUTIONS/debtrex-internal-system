-- ════════════════════════════════════════════════════════════════════
-- DEBTREX MIGRATION 004 — Per-agent Twilio numbers
-- ════════════════════════════════════════════════════════════════════

-- Add Twilio fields to the profiles table.
-- twilio_phone_number: optional Twilio number assigned to this agent for outbound caller ID
-- twilio_phone_label:  friendly label ("NYC line", "Florida line") — purely cosmetic
-- twilio_phone_assigned_at / by: audit trail
alter table profiles add column if not exists twilio_phone_number text;
alter table profiles add column if not exists twilio_phone_label text;
alter table profiles add column if not exists twilio_phone_assigned_at timestamptz;
alter table profiles add column if not exists twilio_phone_assigned_by uuid references profiles(id);

-- Constraint: each Twilio number can only be assigned to ONE agent at a time
create unique index if not exists profiles_twilio_phone_unique
  on profiles(twilio_phone_number)
  where twilio_phone_number is not null;

-- ─── DONE ───
-- Verify:
--   select id, full_name, twilio_phone_number, twilio_phone_label from profiles;
