-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 014 — add state + address to leads
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds location fields captured during lead entry. Idempotent — safe to
-- re-run. Requires migration-013 (creates the leads table) to have run first.
-- ═══════════════════════════════════════════════════════════════════════════

alter table leads add column if not exists state text;
alter table leads add column if not exists address text;

create index if not exists leads_state_idx on leads(state);
