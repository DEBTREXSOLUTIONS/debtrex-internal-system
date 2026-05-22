-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 015 — Two-Factor Authentication (TOTP)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds authenticator-app (TOTP) 2FA fields to profiles. Idempotent — safe to
-- re-run.
--
--   totp_secret      base32 secret shared with the user's authenticator app.
--                    Set when enrollment starts; persists after enrollment.
--   totp_enabled     true once the user has confirmed enrollment with a code.
--                    Login forces enrollment while this is false.
--   totp_enrolled_at when enrollment was completed (informational / audit).
-- ═══════════════════════════════════════════════════════════════════════════

alter table profiles add column if not exists totp_secret text;
alter table profiles add column if not exists totp_enabled boolean not null default false;
alter table profiles add column if not exists totp_enrolled_at timestamptz;
