-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 012 — outbound_use_default flag on profiles
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Some Twilio numbers can receive calls but get rejected by Twilio's
-- outbound carriers when used as caller ID (carrier-side flag, expired
-- 10DLC registration, brand verification issue, etc.). Symptom: agent
-- assigned that number hears "we're sorry, your call could not be
-- completed" on every outbound; calls don't appear in Twilio Monitor.
--
-- This flag lets an admin keep the number assigned to the agent (so
-- inbound routing still works) while forcing outbound to use the
-- TWILIO_PHONE_NUMBER env default instead.
-- ═══════════════════════════════════════════════════════════════════════════

alter table profiles
  add column if not exists outbound_use_default boolean not null default false;

comment on column profiles.outbound_use_default is
  'When true, voice-twiml ignores this profile''s twilio_phone_number for outbound calls and uses TWILIO_PHONE_NUMBER instead. Inbound routing still uses the assigned number.';
