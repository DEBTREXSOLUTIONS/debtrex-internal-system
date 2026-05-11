-- ════════════════════════════════════════════════════════════════════
-- DEBTREX MIGRATION 006 — Seed missing permission keys
-- ════════════════════════════════════════════════════════════════════
-- The Sidebar previously had hardcoded `isLeadership` checks for the
-- Twilio Numbers and Custom Roles pages. This migration adds them as
-- proper permissions so custom roles can be granted access.
--
-- Three new permission keys are seeded:
--   section.twilio_numbers
--   section.custom_roles
--   roles.manage

-- Helper
create or replace function seed_perm_if_missing(p_role text, p_key text, p_enabled boolean)
returns void as $$
begin
  insert into role_permissions (role, permission_key, enabled)
  values (p_role, p_key, p_enabled)
  on conflict (role, permission_key) do nothing;
end;
$$ language plpgsql;

-- Default: leadership gets the new perms ON; everyone else gets them seeded OFF
do $$
declare
  r record;
begin
  for r in select role_key from custom_roles loop
    if r.role_key in ('ceo', 'owner', 'co-owner') then
      perform seed_perm_if_missing(r.role_key, 'section.twilio_numbers', true);
      perform seed_perm_if_missing(r.role_key, 'section.custom_roles', true);
      perform seed_perm_if_missing(r.role_key, 'roles.manage', true);
    else
      -- Seed OFF for non-leadership (CEO can flip them on for any role via /permissions)
      perform seed_perm_if_missing(r.role_key, 'section.twilio_numbers', false);
      perform seed_perm_if_missing(r.role_key, 'section.custom_roles', false);
      perform seed_perm_if_missing(r.role_key, 'roles.manage', false);
    end if;
  end loop;
end $$;

drop function if exists seed_perm_if_missing(text, text, boolean);

-- ─── DONE ───
-- Now /permissions page will show 3 new toggles in the Section Visibility
-- and Permissions Admin groups. Flip them on for your "system" role.
