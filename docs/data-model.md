# Data Model

All tables live in the public schema in Supabase. The canonical schema is `database/schema.sql`; tables added later live in `database/migration-NNN.sql` files.

## Entity overview

```
profiles ─┬─< tasks ─< task_updates
          │         └< task_notes
          ├─< events
          ├─< expenses ─approved_by─┐
          │                         │
          ├─< income                │
          ├─< budgets               │
          ├─< pipeline_contacts ─< call_logs
          │                       └< contact_notes
          │                       └< pipeline_collaborators
          ├─< manager_assignments  (self-join: manager_id, agent_id)
          ├─< notifications
          ├─< audit_log
          └─< calculations  (saved calculator results — migration-004)

role_permissions   (role × permission_key → enabled bool)
custom_roles       (role registry — built-in flags + custom additions)
phone_number_routing  (Twilio inbound routing config)
```

## Tables

### `profiles` — users
| Column | Notes |
|--------|-------|
| `id` (uuid, PK) | |
| `email` (unique) | Login identity |
| `password_hash` | bcrypt, cost 10 |
| `full_name` | |
| `role` | Stored as text — both built-in (`ceo`, `owner`, `co-owner`, `manager`, `employee`, `accountant`, `viewer`) and custom role keys live here. The CHECK constraint was dropped in migration-005 so custom roles work. |
| `is_active` | Toggle to soft-disable a user without deleting |
| `google_drive_folder_id`, `google_access_token`, `google_refresh_token`, `google_token_expires_at` | Per-user Drive OAuth |
| `status`, `status_message`, `status_updated_at` | Online/OTL/meeting/break/offline presence (migration-007) |
| `notification_preferences` | jsonb — opt-out flags for email categories |

Indexes: `email`, `role`, partial `status WHERE is_active = true`.

### `tasks` — work items
Owned by `created_by`, worked on by `assigned_to`. Status: `not_started → in_progress → submitted → completed`, plus `overdue` and `cancelled`. Priority is `low/medium/high/urgent`. Indexed on `assigned_to`, `created_by`, `status`, `deadline`.

### `task_updates` — work log
Hours, status changes, free-text. Used to compute performance metrics and "recent activity" feeds. Indexed on `task_id`.

### `task_notes`
Short discussion thread on a task. No index — query goes through `task_id` only and the table is small.

### `events` — calendar
Includes visibility scope (`private`/`team`/`company`), color, all-day flag. Indexed on `start_time`. Calendar pages should always query with a date window — the page reads ±6 months around today.

### `event_attendees`
M:N junction between `events` and `profiles`. Composite PK `(event_id, user_id)`.

### `budgets` — monthly allocations
Per `(month, category)` — `month` is a `date` truncated to the first of the month. Unique on `(month, category)`.

### `expenses`
Submitter is `paid_by`, approver is `approved_by`. Status: `submitted → approved → reimbursed` (or `rejected`). Indexed on `paid_by`, `status`, `expense_date`.

### `income`
Recorded against a category and date. No FK on category — free text. Indexed on `received_date`.

### `audit_log`
Append-only trail. `action`, `resource_type`, `resource_id`, plus `details` jsonb and ip/user-agent.

### `notifications`
In-app notification queue. `is_read` flag. Composite index on `(user_id, is_read)` for fast unread-count.

### `role_permissions` — granular auth (migration-003)
One row per (role, permission_key) pair with an `enabled` bool. Unique on `(role, permission_key)`. Seeded with sensible defaults; CEO toggles from `/permissions` UI. Read via `lib/permissions.ts`.

### `custom_roles` — role registry (migration-005)
Lists every role usable in `profiles.role`. Built-in roles are seeded with `is_built_in = true`. Custom roles created via `/roles` admin UI default to `is_built_in = false` and start with all permissions OFF.

### `pipeline_contacts` (migration-003)
Unified table for both pipelines. `pipeline_type` discriminates `'management'` (B2B deals) from `'sales'` (debt-relief leads). Different columns matter for each. Status is free text but distinct vocabularies per pipeline (see `app/pipeline/PipelineList.tsx`). Indexed on type, status, `assigned_to`, `next_followup_at`.

### `call_logs` (migration-003 + 007)
Every call attempt. `direction` is `outbound` or `inbound`. `outcome` is one of a fixed list (extended in 007 to add the `inbound_*` cases). For inbound calls that didn't match a contact, `contact_id` is null and `from_number` carries the caller's number. Composite indexes on `(contact_id, called_at desc)` and `(user_id, called_at desc)` and `(direction, called_at desc)`.

### `contact_notes` (migration-003)
Sticky notes on a contact, separate from per-call notes. `is_pinned` flag.

### `pipeline_collaborators` (migration-005)
Lets multiple people share a contact beyond the single `assigned_to`. Either `collaborator` (full edit) or `observer` (read-only). Unique on `(contact_id, user_id)`.

### `manager_assignments`
Self-referential M:N between profiles (manager_id ↔ agent_id). Used by the performance dashboard so managers only see their assigned agents.

### `calculations` (migration-004)
Saved calculator results — debt scenarios. Owned by `user_id`.

### `phone_number_routing` (migration-007)
For each Twilio number, where inbound calls go:
- `agent` → ring a specific person
- `available` → ring all online agents
- `voicemail` → straight to voicemail

## Conventions

- **Primary keys are uuid** (`uuid_generate_v4()`). The `uuid-ossp` extension must be enabled.
- **Timestamps** are `timestamptz`, defaulted to `now()`. `updated_at` is auto-bumped via the `update_updated_at_column()` trigger on tables that need it.
- **Money** is `numeric(12,2)`. Don't use float.
- **Soft delete** is `is_active = false` on `profiles`. Other tables are hard-deleted (often via `ON DELETE CASCADE`).
- **Status / enum fields** are stored as `text` with CHECK constraints. To add a new value you alter the constraint in a migration — see migration-007 for `call_logs.outcome` as the pattern.

## Adding a column or table

1. Create `database/migration-NNN.sql` (next number).
2. Write `alter table ... add column if not exists ...` or `create table if not exists ...`.
3. Add any needed indexes — usually one per `eq()` filter column the app uses.
4. Open Supabase SQL editor → paste → run.
5. Update relevant TypeScript types — there are no generated types in this repo, so you're updating literal types in `lib/auth.ts`, route handlers, etc.
