-- ════════════════════════════════════════════════════════════════════
-- DEBTREX MIGRATION 010 — User-delete safety: relax FKs to profiles(id)
-- ════════════════════════════════════════════════════════════════════
-- The "hard delete users" feature added in commit e09aa35 only works if
-- every FK pointing at profiles(id) either CASCADEs or SET NULLs on
-- delete. Most of them did neither (default NO ACTION), and several
-- were also NOT NULL — so deleting a user fails as soon as they have
-- any task/call/expense/audit row.
--
-- This migration:
--   1. Swaps every relevant FK to ON DELETE SET NULL.
--   2. Drops NOT NULL on columns that need to be nullable for SET NULL
--      to work. Application code already expects these to possibly be
--      null per the comment in app/api/users/[id]/route.ts:73-74.
--
-- CASCADE remains on rows that are inherently user-scoped seats:
--   manager_assignments.manager_id / agent_id
--   event_attendees.user_id
--   pipeline_collaborators.user_id
--   notifications.user_id
-- These rows have no meaning without the user, so they should die with
-- them.
-- ════════════════════════════════════════════════════════════════════

-- ─── Helper: swap FK to ON DELETE SET NULL (idempotent) ───
-- Drops the existing constraint and re-adds it with the desired action.
create or replace function _swap_fk_set_null(
  p_table text,
  p_column text
) returns void as $$
declare
  v_constraint text := p_table || '_' || p_column || '_fkey';
begin
  execute format('alter table %I drop constraint if exists %I', p_table, v_constraint);
  execute format(
    'alter table %I add constraint %I foreign key (%I) references profiles(id) on delete set null',
    p_table, v_constraint, p_column
  );
end;
$$ language plpgsql;


-- ─── 1. tasks ───
alter table tasks alter column created_by  drop not null;
alter table tasks alter column assigned_to drop not null;
select _swap_fk_set_null('tasks', 'created_by');
select _swap_fk_set_null('tasks', 'assigned_to');

-- ─── 2. task_updates ───
alter table task_updates alter column user_id drop not null;
select _swap_fk_set_null('task_updates', 'user_id');

-- ─── 3. task_notes ───
alter table task_notes alter column user_id drop not null;
select _swap_fk_set_null('task_notes', 'user_id');

-- ─── 4. events ───
alter table events alter column created_by drop not null;
select _swap_fk_set_null('events', 'created_by');

-- ─── 5. budgets ───
select _swap_fk_set_null('budgets', 'created_by');

-- ─── 6. expenses ───
alter table expenses alter column paid_by drop not null;
select _swap_fk_set_null('expenses', 'paid_by');
select _swap_fk_set_null('expenses', 'approved_by');

-- ─── 7. income ───
select _swap_fk_set_null('income', 'recorded_by');

-- ─── 8. audit_log ───
select _swap_fk_set_null('audit_log', 'user_id');

-- ─── 9. notifications ───
-- already ON DELETE CASCADE — leave as-is (user-scoped, dies with user)

-- ─── 10. profiles.twilio_phone_assigned_by (self-reference) ───
select _swap_fk_set_null('profiles', 'twilio_phone_assigned_by');

-- ─── 11. manager_assignments ───
-- manager_id / agent_id already CASCADE — leave as-is
select _swap_fk_set_null('manager_assignments', 'assigned_by');

-- ─── 12. client_calculations ───
alter table client_calculations alter column created_by drop not null;
select _swap_fk_set_null('client_calculations', 'created_by');

-- ─── 13. pipeline_contacts ───
alter table pipeline_contacts alter column created_by drop not null;
select _swap_fk_set_null('pipeline_contacts', 'created_by');
select _swap_fk_set_null('pipeline_contacts', 'assigned_to');

-- ─── 14. call_logs ───
alter table call_logs alter column user_id drop not null;
select _swap_fk_set_null('call_logs', 'user_id');

-- ─── 15. contact_notes ───
alter table contact_notes alter column user_id drop not null;
select _swap_fk_set_null('contact_notes', 'user_id');

-- ─── 16. role_permissions ───
select _swap_fk_set_null('role_permissions', 'updated_by');

-- ─── 17. custom_roles ───
select _swap_fk_set_null('custom_roles', 'created_by');

-- ─── 18. pipeline_collaborators ───
-- user_id already CASCADE — leave as-is (the seat row dies with the user)
alter table pipeline_collaborators alter column added_by drop not null;
select _swap_fk_set_null('pipeline_collaborators', 'added_by');

-- ─── 19. phone_number_routing ───
select _swap_fk_set_null('phone_number_routing', 'primary_agent_id');

-- ─── 20. task_requests ───
alter table task_requests alter column requested_by drop not null;
alter table task_requests alter column assigned_to  drop not null;
select _swap_fk_set_null('task_requests', 'requested_by');
select _swap_fk_set_null('task_requests', 'assigned_to');
select _swap_fk_set_null('task_requests', 'target_approver');
select _swap_fk_set_null('task_requests', 'resolved_by');

-- ─── 21. scripts library ───
select _swap_fk_set_null('script_sections', 'created_by');
select _swap_fk_set_null('scripts',         'created_by');
select _swap_fk_set_null('script_tags',     'created_by');


-- ─── Cleanup ───
drop function _swap_fk_set_null(text, text);


-- ─── Verify (run these to confirm) ───
-- Show every FK to profiles and its on-delete action:
--   ('a' = NO ACTION, 'r' = RESTRICT, 'c' = CASCADE, 'n' = SET NULL, 'd' = SET DEFAULT)
--
--   select c.conname,
--          t.relname  as table_name,
--          a.attname  as column_name,
--          c.confdeltype
--     from pg_constraint c
--     join pg_class t on t.oid = c.conrelid
--     join pg_class rt on rt.oid = c.confrelid
--     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
--    where c.contype = 'f' and rt.relname = 'profiles'
--    order by t.relname, a.attname;
