# Feature Walkthroughs

This doc walks you through every feature of the website. For each one you get:

- What the user sees
- Which files run when they use it
- Which database tables are touched
- Which permissions gate it
- The most common edits you'll make

If you want the higher-level "how to build a new feature" recipe, see [EDITING-GUIDE.md § 12](EDITING-GUIDE.md#12-adding-a-brand-new-feature-from-scratch).

---

## Index

1. [Authentication & Sessions](#1-authentication--sessions)
2. [Dashboard (`/`)](#2-dashboard-)
3. [Tasks (`/tasks`)](#3-tasks-tasks)
3b. [Task Requests (`/tasks/requests`)](#3b-task-requests-tasksrequests)
4. [Calendar (`/calendar`)](#4-calendar-calendar)
5. [Pipeline — Sales & Management (`/pipeline/*`)](#5-pipeline--sales--management-pipeline)
6. [Phone calls — outbound + inbound (Twilio)](#6-phone-calls--outbound--inbound-twilio)
7. [Budget — Income, Expenses, Allocations (`/budget`)](#7-budget--income-expenses-allocations-budget)
8. [Files & Google Drive (`/files`)](#8-files--google-drive-files)
9. [Performance & Manager Assignments (`/performance`)](#9-performance--manager-assignments-performance)
10. [Calculators (`/calculators`)](#10-calculators-calculators)
11. [Team (`/team`)](#11-team-team)
12. [Custom Roles (`/roles`)](#12-custom-roles-roles)
13. [Permissions Admin (`/permissions`)](#13-permissions-admin-permissions)
14. [Twilio Numbers Admin (`/twilio-numbers`)](#14-twilio-numbers-admin-twilio-numbers)
15. [Notifications (`/notifications`)](#15-notifications-notifications)
16. [Settings (`/settings`)](#16-settings-settings)
17. [Status & Presence (in TopBar)](#17-status--presence-in-topbar)

---

## 1. Authentication & Sessions

**What the user sees**
- `/login` — email + password form.
- Successful login → redirect to `/`.
- Anything else without a cookie → bounced to `/login`.
- After 8 hours of no activity, their cookie expires and they're bounced back.

**Files**
| File | Role |
|------|------|
| `app/login/page.tsx` | The login form (client). |
| `app/api/auth/login/route.ts` | Validates email/password, signs JWT, sets cookie. |
| `app/api/auth/logout/route.ts` | Clears the cookie. |
| `app/api/auth/setup/route.ts` | Creates the first CEO. Refuses if any users exist. |
| `middleware.ts` | Checks the cookie on every other request. |
| `lib/auth.ts` | `getCurrentUser()`, `createSessionToken()`, `verifyPassword()`, etc. |

**Tables**
- `profiles` — `email`, `password_hash` (bcrypt cost 10), `is_active`, `last_login_at`.
- `audit_log` — every login is recorded.

**Permissions**
- None. The login flow is public. Inactive accounts are blocked by `is_active = false` on the profile.

**Common edits**
- **Change the session length.** `lib/auth.ts` → `expiresIn: '8h'`. Also update `maxAge: 8 * 60 * 60` in `attachSessionCookie`.
- **Add 2FA.** Significant change — you'd add a `totp_secret` column, a verification step in `/api/auth/login`, and a UI. Not done today.
- **Force users to re-login when their role changes.** Already happens automatically — `getCurrentUser()` re-fetches the profile every request, so a deactivated user is kicked on the very next nav.
- **Change the cookie name.** `lib/auth.ts` → `COOKIE_NAME`. Also update `middleware.ts` references. (Don't bother — there's no reason to.)

---

## 2. Dashboard (`/`)

**What the user sees**
- 4 KPI cards: open tasks, in-progress count, overdue count, today's events.
- A list of their open tasks (5 most due soon).
- Today's events.
- Recent activity (their last 3 task updates).
- Quick action buttons.

**Files**
- `app/page.tsx` — the whole dashboard. Pure server component. No client wrapper.

**Tables**
- `tasks` (filtered by `assigned_to = me`)
- `task_updates` (filtered by `user_id = me`)
- `events` (today's only)

**Permissions**
- `section.dashboard` to even see it (defaults to true for everyone).

**Common edits**
- **Add another KPI card.** Edit `app/page.tsx`. The `KPICard` component is right at the bottom — just call it with the new label/value. If the value needs DB data, add another `supabaseAdmin.from(...)` to the `Promise.all`.
- **Show more / fewer tasks.** Change `.limit(5)` in the tasks query.
- **Show tasks from team, not just self.** Remove the `.eq('assigned_to', user.id)` filter and adjust based on role.
- **Change KPI colors.** Look at `function KPICard` near the bottom — the `colors` object maps `red/blue/gray` to Tailwind classes.

---

## 3. Tasks (`/tasks`)

**What the user sees**
- A grid of tasks with status / priority badges.
- Filter tabs: "Assigned to Me", "Created by Me", "All Tasks" (only for leadership/manager).
- Detail page at `/tasks/[id]` — task fields, work log (updates), notes.
- "New Task" form at `/tasks/new`.

**Files**
| File | Role |
|------|------|
| `app/tasks/page.tsx` | List page. Filters via query string. |
| `app/tasks/new/page.tsx` + `NewTaskForm.tsx` | Create form. |
| `app/tasks/[id]/page.tsx` | Detail view. |
| `app/tasks/[id]/TaskWorkTracker.tsx` | Client-side timer + status updates. |
| `app/api/tasks/route.ts` | `POST` — create a task. |
| `app/api/tasks/[id]/route.ts` | `PATCH` — update fields (status, etc). |
| `app/api/tasks/[id]/updates/route.ts` | `POST` — add a work-log entry. |
| `app/api/tasks/[id]/notes/route.ts` | `POST` — add a discussion note. |
| `lib/email.ts` | `sendTaskAssignedEmail`, `sendTaskOverdueEmail`. |

**Tables**
- `tasks` — main row.
- `task_updates` — every status change and work-log entry.
- `task_notes` — free-form discussion.
- `notifications` — bell-icon entry when assigned.
- `audit_log` — every create.

**Permissions**
- `section.tasks` — see the section.
- `task.create` — create new tasks.
- `task.edit_any` — edit tasks you didn't create.
- `task.delete` — delete (currently no API exposes delete).
- `task.assign_to_anyone` — assign to others, not just self.
- `task.view_all` — see the "All Tasks" filter.

**Lifecycle**
```
not_started → in_progress → submitted → completed
                                       ↘ cancelled
                                       ↘ overdue   (set automatically on deadline pass)
```

**Common edits**
- **Add a "labels" field** — column on `tasks` + migration, expose in the form, store, render.
- **Email when a task is reassigned.** Currently only when created. In `app/api/tasks/[id]/route.ts`, detect when `body.assigned_to` differs from the current row's, and call `sendTaskAssignedEmail` again.
- **Auto-mark overdue** — add a Vercel Cron job (see [EDITING-GUIDE Recipe 11](EDITING-GUIDE.md#recipe-11--schedule-a-recurring-job)) that updates tasks with `deadline < now() AND status NOT IN ('completed','cancelled')` to `overdue` and sends `sendTaskOverdueEmail`.

---

## 3b. Task Requests (`/tasks/requests`)

**What the user sees**
- Anyone with `task.request` can submit a new task request from the "Requests" tab. The request goes into a pending queue — it is NOT a real task yet.
- Admin-level users (CEO / Owner / Co-Owner / Manager by default) get an inbox at `/tasks/requests` showing pending requests. They can **Approve** (creates the actual task) or **Deny** (records a required reason).
- The requester can **Cancel** their own pending request.
- A red banner with the pending count appears on the dashboard `/` and on `/tasks` for approvers.

**Manager scope**
- CEO / Owner / Co-Owner see ALL pending requests.
- Manager sees only requests where the requester is one of their assigned agents (`manager_assignments`), plus requests explicitly targeted at them, plus their own.

**Files**
| File | Role |
|------|------|
| `database/migration-008.sql` | Table + permission seeds. |
| `app/tasks/requests/page.tsx` | Server page — fetches the right rows per scope. |
| `app/tasks/requests/TaskRequestsView.tsx` | Client UI — list cards, filter tabs, new-request modal, deny modal. |
| `app/api/task-requests/route.ts` | `GET` (list, scope-aware) + `POST` (create). |
| `app/api/task-requests/[id]/route.ts` | `PATCH` with `action: 'approve' \| 'deny' \| 'cancel'`. |
| `app/tasks/page.tsx` | Adds "Requests" tab + banner. |
| `app/page.tsx` | Adds dashboard banner. |

**Tables**
- `task_requests` — main row, with `status pending|approved|denied|cancelled`, `created_task_id` link to the resulting task.
- `tasks` — written to on approve.
- `task_updates` — system "created from request" entry.
- `notifications` — bell-icon entries to approvers and to requester on resolution.
- `audit_log` — every create / approve / deny.

**Permissions**
- `task.request` — submit a request.
- `task.approve_requests` — see + approve/deny incoming requests.
- Manager scope is enforced in the API query, NOT in the permission system. Don't confuse "permission" (what your role can do at all) with "scope" (which rows it can do it on).

**Common edits**
- **Allow accountant to approve.** Sign in as CEO → `/permissions` → toggle on `task.approve_requests` for accountant. No code change.
- **Add a field to the request** (e.g. budget impact). Migration to add column → input in `TaskRequestsView`'s new-request modal → accept in `POST /api/task-requests` → render in the card.
- **Auto-approve trivial requests.** In `POST /api/task-requests`, if the requester == assignee and priority != urgent, you could immediately create the task and skip the queue. Be careful — this defeats the audit-trail benefit.

For the full step-by-step record of how this was built, see [HOW-I-BUILT-task-requests.md](HOW-I-BUILT-task-requests.md).

---

## 4. Calendar (`/calendar`)

**What the user sees**
- Full-screen FullCalendar (month / week / day) with events colored by category, plus task deadlines as red blocks.
- Click an empty slot or "+ New Event" → create modal.
- Auto-pulled task deadlines are read-only (they live in `tasks` not `events`).

**Files**
| File | Role |
|------|------|
| `app/calendar/page.tsx` | Server fetch of events ± 6 months around today, + tasks with deadlines. |
| `app/calendar/CalendarView.tsx` | Client component wrapping `@fullcalendar/react`. Holds the create modal. |
| `app/api/events/route.ts` | `POST` — create an event + attendees. |

**Tables**
- `events`
- `event_attendees` (M:N junction)
- `tasks` (read-only — deadlines surface here)

**Permissions**
- `section.calendar`
- `event.create`
- `event.edit_any` / `event.delete` — currently no edit/delete API exposed.
- `event.invite_anyone` — invite others to events.

**Common edits**
- **Add recurring events.** The schema has a `recurring_pattern` column but it's not implemented. You'd need to expand it client-side (FullCalendar supports recurring via RRULE) and store the rule string.
- **Add event editing.** Add a `PATCH /api/events/[id]/route.ts` mirroring the create handler. Then add an edit modal in `CalendarView.tsx` triggered by clicking an event.
- **Change the date window** — `app/calendar/page.tsx` currently fetches ± 6 months. Change the math at the top of the file.
- **Add invitations by email.** After insert, loop over `attendees` and call a new `sendCalendarInviteEmail` in `lib/email.ts`.

---

## 5. Pipeline — Sales & Management (`/pipeline/*`)

This is the biggest, most complex module. Read it last.

**Two pipelines, one table.** The `pipeline_contacts` table has a `pipeline_type` column with two valid values:
- `sales` — debt-relief leads (consumers).
- `management` — B2B deals.

Each has its own page, its own status vocabulary, and its own set of UI labels — but they share the same code path.

**What the user sees**
- A list of contacts (cards).
- Click a contact → detail page with notes, call log, collaborators.
- "Add Contact" form at the top of the list.
- A built-in dialer for outbound calls (Twilio Voice SDK).

**Files**
| File | Role |
|------|------|
| `app/pipeline/sales/page.tsx` | Sales list. Renders `<PipelinePageBase>` with `pipeline_type="sales"`. |
| `app/pipeline/management/page.tsx` | Management list. Same wrapper, different type. |
| `app/pipeline/sales/[id]/page.tsx`, `.../management/[id]/page.tsx` | Detail wrappers — both call `<ContactDetailBase>`. |
| `app/pipeline/PipelinePageBase.tsx` | The shared list page (server). |
| `app/pipeline/PipelineList.tsx` | The shared client list (cards, filters, modals). |
| `app/pipeline/ContactDetailBase.tsx` | Detail page (server). |
| `app/pipeline/ContactDetail.tsx` | Detail UI (client). Holds notes editor, call buttons, collaborator manager. |
| `app/api/pipeline/route.ts` | `POST` — create contact. |
| `app/api/pipeline/[id]/route.ts` | `PATCH` / `DELETE`. |
| `app/api/pipeline/[id]/calls/route.ts` | `POST` — manual call log entry. |
| `app/api/pipeline/[id]/notes/route.ts` | `POST` — add a sticky note. |
| `app/api/pipeline/notes/[id]/route.ts` | `PATCH` / `DELETE` — edit / delete a note. |
| `app/api/pipeline/[id]/collaborators/route.ts` | `GET`, `POST` — list / add collaborators. |
| `app/api/pipeline/collaborators/[collabId]/route.ts` | `DELETE`. |

**Tables**
- `pipeline_contacts` — both pipelines.
- `call_logs` — every outbound + inbound attempt.
- `contact_notes` — sticky notes (separate from per-call notes).
- `pipeline_collaborators` — additional users with access beyond `assigned_to`.

**Permissions**
- `section.pipeline_sales`, `section.pipeline_management`.
- `pipeline.create` — add contacts.
- `pipeline.edit_any` — edit contacts you aren't owner/collaborator on.
- `pipeline.delete` — delete contacts.
- `pipeline.view_all` — see contacts not assigned to you. (Without this, you only see your own + collaborator-assigned.)
- `pipeline.assign_to_anyone` — change `assigned_to` on a contact.
- `pipeline.export` — export to CSV (not implemented yet, but the flag exists).
- `call.log` — manually add a call log row.
- `call.make` — get a Twilio Voice token to actually call.
- `call.view_all` — see other people's call logs.

**Owner / Collaborator model**
A contact has one `assigned_to`. Other users can be added as either:
- `collaborator` (role text in `pipeline_collaborators`) — full edit access.
- `observer` — read-only.

Many handlers do: `const canAccess = assigned_to === user.id || isCollaborator || hasPermission('pipeline.view_all')`.

**Common edits**
- **Add a new column** (e.g. "lead source"). Migration → form input in `PipelineList.tsx` → accept it in the POST handler → render it in `ContactDetail.tsx`.
- **Add a new status value.** Status is currently free text per pipeline type. Look in `app/pipeline/PipelineList.tsx` for the dropdown options array and add yours.
- **Export contacts as CSV.** New route `app/api/pipeline/export/route.ts` that gates on `pipeline.export`, queries `pipeline_contacts`, returns `text/csv` with `Content-Disposition: attachment`.

---

## 6. Phone calls — outbound + inbound (Twilio)

The most external-facing module. Lots of moving parts. Here's the whole picture.

### 6a. Outbound (browser dialer)

**What happens**
1. User clicks "Call" on a contact.
2. The browser asks `/api/twilio/voice-token` for a short-lived JWT scoped to the Voice SDK.
3. With that token, the SDK opens a peer connection.
4. Twilio bridges the SDK to the contact's phone number via `/api/twilio/twiml/dial`.
5. While the call runs, lifecycle webhooks (`/status`, `/recording`, `/amd`) hit our server with updates.
6. When the call ends, the browser POSTs to `/api/twilio/log-browser-call` so we persist the row.

**Files**
| File | Role |
|------|------|
| `components/BrowserDialer.tsx` | The floating dial widget (mounted via pipeline + tasks). |
| `app/api/twilio/voice-token/route.ts` | Mints the Voice JWT. |
| `app/api/twilio/twiml/dial/route.ts` | Returns TwiML that bridges to the real phone number. |
| `app/api/twilio/status/route.ts` | Lifecycle callback — updates `call_logs` row. |
| `app/api/twilio/recording/route.ts` | Stores recording URL after it's ready. |
| `app/api/twilio/amd/route.ts` | Stores answering-machine detection result. |
| `app/api/twilio/log-browser-call/route.ts` | Persists the call row when browser side ends. |
| `lib/twilio.ts` | REST client + helpers. |
| `lib/twilio-voice.ts` | JWT minting for the Voice SDK. |

### 6b. Inbound

**What happens**
1. Someone dials a Twilio number you own.
2. Twilio calls `/api/twilio/inbound`.
3. The handler reads `phone_number_routing` for that number and decides:
   - `agent` → ring a specific user's browser (TwiML `<Dial><Client>...`).
   - `available` → ring ALL online agents at once.
   - `voicemail` → straight to voicemail (records to `/api/twilio/voicemail`).
4. If a browser is online, `InboundCallListener` (mounted from Sidebar) shows the toast and bridges.

**Files**
| File | Role |
|------|------|
| `app/api/twilio/inbound/route.ts` | Primary handler — decides routing. |
| `app/api/twilio/inbound-fallback/route.ts` | Used if `/inbound` errors. |
| `app/api/twilio/voicemail/route.ts` | Stores the voicemail recording. |
| `app/api/twilio/voice-twiml/route.ts` | TwiML for the browser identity. |
| `components/InboundCallListener.tsx` | Listens on the SDK for incoming calls; shows a toast. |
| `app/twilio-numbers/...` + `/api/twilio/routing/...` | Admin UI to assign routing per number. |

**Tables**
- `call_logs` — every inbound + outbound attempt. `direction` = `inbound` / `outbound`. For inbound that didn't match a contact, `contact_id` is null and `from_number` carries the caller.
- `phone_number_routing` — admin config per Twilio number.
- `profiles.status` — used by "available" routing to pick agents.

**Permissions**
- `call.make` — required for the Voice token.
- `call.log` — manually log a call.
- `call.view_all` — see other people's call rows.

**Webhook safety**
- Twilio webhook paths are listed in `middleware.ts` (`TWILIO_WEBHOOK_PREFIXES`) so they bypass the cookie check.
- **In production, you should validate the `X-Twilio-Signature` header** before trusting the body. Currently not enforced — there's a TODO comment in `middleware.ts`. To add: in each webhook handler, import `validateRequest` from `twilio` and compare.

**Common edits**
- **Add a new outcome value** (e.g. `transferred`). Migration to extend the `check (outcome in (...))` constraint on `call_logs`. Then update the dropdowns in `ContactDetail.tsx`.
- **Add SMS.** Currently no SMS. You'd add a route `POST /api/twilio/sms/send` that uses `twilio.messages.create(...)` and a webhook `/api/twilio/sms/inbound` (whitelist in middleware).
- **Change call recording behavior.** TwiML in `/api/twilio/twiml/dial/route.ts` has a `record="record-from-answer"` attribute. Remove or change to control recording.

---

## 7. Budget — Income, Expenses, Allocations (`/budget`)

**What the user sees**
- Dashboard at `/budget` — current month at-a-glance: planned vs actual per category, totals, recent expenses, recent income.
- `/budget/allocations` — set the monthly budget per category.
- Expense submission form (anywhere with the right permission).
- Expense list with approve/reject buttons (for approvers).

**Files**
| File | Role |
|------|------|
| `app/budget/page.tsx` | Dashboard data fetch. |
| `app/budget/BudgetDashboard.tsx` | UI. |
| `app/budget/allocations/page.tsx` + `BudgetAllocations.tsx` | Per-category allocation editor. |
| `app/api/budgets/route.ts` | `POST` allocation. |
| `app/api/budgets/[id]/route.ts` | `DELETE` allocation. |
| `app/api/budgets/copy-previous/route.ts` | Copy last month's allocations forward. |
| `app/api/expenses/route.ts` | `POST` submit expense. |
| `app/api/expenses/[id]/route.ts` | `PATCH` approve/reject/edit. |
| `app/api/income/route.ts` | `POST` record income. |

**Tables**
- `budgets` (one row per month×category; unique on that pair).
- `expenses` — `submitted → approved → reimbursed` (or `rejected`).
- `income`.

**Permissions**
- `section.budget`.
- `budget.view`.
- `budget.edit_allocations`.
- `expense.submit`.
- `expense.approve`.
- `income.record`.

**Common edits**
- **Add a new expense category.** Category is free text. Look in `BudgetAllocations.tsx` for the dropdown options — add yours.
- **Require receipt for expenses over $X.** In the submit handler, check `body.amount > 100 && !body.receipt_drive_id` → return 400.
- **Email finance team on approve.** After the PATCH that flips status to `approved`, send via `sendEmail()`.

---

## 8. Files & Google Drive (`/files`)

**What the user sees**
- "Connect Google Drive" button if they haven't yet → opens OAuth in a new window → returns and shows their personal folder.
- A simple file list with upload + delete.
- Each user's files live in their own Drive folder (linked on `profiles.google_drive_folder_id`).

**Files**
| File | Role |
|------|------|
| `app/files/page.tsx` + `FilesView.tsx` | UI. |
| `app/api/google/auth/route.ts` | Builds the consent URL, redirects there. |
| `app/api/google/callback/route.ts` | Receives the code, exchanges for tokens, stores them on the profile. Public — Google calls it. |
| `app/api/files/upload/route.ts` | POST a multipart-form file → uploads to Drive. |
| `app/api/files/[id]/route.ts` | DELETE a file. |
| `lib/google-drive.ts` | OAuth helpers + Drive API wrapper. |

**Tables**
- `profiles.google_drive_folder_id`, `google_access_token`, `google_refresh_token`, `google_token_expires_at`.

**Permissions**
- `section.files`.
- No granular permissions on upload/delete — Drive is per-user.

**Common edits**
- **Force a specific folder structure.** In `lib/google-drive.ts`, the function that creates a user's root folder also creates sub-folders. Add to that list.
- **Allow uploading to a shared folder** (not just personal). You'd add a new "scope" param to `/api/files/upload` and route the upload to the relevant Drive folder ID.

---

## 9. Performance & Manager Assignments (`/performance`)

**What the user sees**
- Per-agent metrics: tasks completed, hours logged, calls made, conversion %.
- Leaderboards.
- Managers see only their assigned agents. Leadership sees everyone.
- `/performance/assignments` — admin UI to assign agents to managers.

**Files**
| File | Role |
|------|------|
| `app/performance/page.tsx` + `PerformanceView.tsx` | Main dashboard. |
| `app/performance/assignments/page.tsx` + `AssignmentsManager.tsx` | Admin to wire managers↔agents. |
| `app/api/manager-assignments/route.ts`, `.../[id]/route.ts` | CRUD for the join table. |
| `lib/performance.ts` | The KPI computation logic. Pure functions over data. |

**Tables**
- `manager_assignments` — `(manager_id, agent_id)` rows.

**Permissions**
- `section.performance`.
- `performance.view_all` — leadership.
- `performance.view_team` — managers (their assigned agents).
- `performance.assign_managers` — leadership only.

**Common edits**
- **Add a new metric.** In `lib/performance.ts`, extend `computeMetricsForUser()` to return a new field. Then render it in `PerformanceView.tsx`.
- **Change the metric window.** The default is "last 30 days" — change the date filter in `lib/performance.ts`.

---

## 10. Calculators (`/calculators`)

**What the user sees**
- Two tools: DTI (Debt-to-Income) and Budget calculators.
- Each is a form with live computed results.
- Can save a scenario → stored in `calculations`.

**Files**
| File | Role |
|------|------|
| `app/calculators/page.tsx` + `CalculatorsView.tsx` | Wrapper. |
| `app/calculators/DTICalculator.tsx`, `BudgetCalculator.tsx` | The actual UIs. |
| `app/api/calculations/route.ts`, `.../[id]/route.ts` | Save/edit/delete saved scenarios. |

**Tables**
- `calculations` — owned by `user_id`.

**Permissions**
- `section.calculators`.

**Common edits**
- **Add a third calculator** — copy `DTICalculator.tsx` as a starting point, add a tab in `CalculatorsView.tsx`.
- **Add a new field to a saved scenario.** Migration → form input → save it via the POST/PATCH → render it back.

---

## 11. Team (`/team`)

**What the user sees**
- A list of all users with their role, status, Twilio number, etc.
- "Invite User" form — sends them a temp password by email.
- Buttons to change role, deactivate, etc.

**Files**
| File | Role |
|------|------|
| `app/team/page.tsx` + `TeamManager.tsx` | UI. |
| `app/api/users/invite/route.ts` | Creates the profile, hashes a temp password, emails it. |
| `app/api/users/[id]/route.ts` | `PATCH` to change role / active. |
| `app/api/users/[id]/twilio-number/route.ts` | Assign a Twilio number. |
| `lib/email.ts` → `sendInviteEmail` | The invite email template. |

**Tables**
- `profiles`.
- `audit_log` — every invite/role change.

**Permissions**
- `section.team`.
- `team.invite`.
- `team.change_roles`.
- `team.deactivate`.
- `team.delete` (currently no endpoint exposes hard delete — `is_active = false` is preferred).

**Common edits**
- **Pick a stronger temp password.** `app/api/users/invite/route.ts` — look for the `Math.random()` generation and increase length / use crypto.
- **Force password change on first login.** Add a `must_change_password` column to `profiles`, set it true on invite, and add a step in login that redirects to a "change password" page if true.

---

## 12. Custom Roles (`/roles`)

**What the user sees**
- A list of all roles (built-ins + custom).
- "New Role" button → create a custom role with key, label, color.
- Cannot delete built-ins.

**Files**
| File | Role |
|------|------|
| `app/roles/page.tsx` + `RolesManager.tsx` | UI. |
| `app/api/roles/route.ts` | `POST` create. |
| `app/api/roles/[key]/route.ts` | `PATCH` rename/recolor, `DELETE`. |

**Tables**
- `custom_roles` — registry of all roles. Built-ins have `is_built_in = true`.

**Permissions**
- `section.custom_roles`, `roles.manage`.

**Common edits**
- A custom role starts with **all permissions OFF**. Toggle them on at `/permissions`.
- Custom roles don't satisfy hard-coded helpers like `isLeadership()`. If you want a custom role to count as leadership, you'd need to update `lib/roles.ts` to read from the DB instead — non-trivial change.

---

## 13. Permissions Admin (`/permissions`)

**What the user sees**
- A giant matrix: rows = permission keys (grouped), columns = roles, cells = checkbox.
- Save → bulk POST `/api/permissions`.

**Files**
| File | Role |
|------|------|
| `app/permissions/page.tsx` + `PermissionsManager.tsx` | UI. |
| `app/api/permissions/route.ts` | Bulk update. Calls `invalidatePermissionCache()` after. |
| `lib/permissions.ts` | Key list, labels, groups, cache. |

**Tables**
- `role_permissions` — one row per (role, key).

**Permissions**
- `permissions.manage`.

**Common edits**
- See [EDITING-GUIDE § 7.4](EDITING-GUIDE.md#74-adding-a-new-permission--full-walkthrough) for adding a new permission key.

---

## 14. Twilio Numbers Admin (`/twilio-numbers`)

**What the user sees**
- Each Twilio number you own with its current routing target.
- Edit routing per number: ring an agent, ring all available, or voicemail.

**Files**
| File | Role |
|------|------|
| `app/twilio-numbers/page.tsx` + `TwilioNumbersManager.tsx` | UI. |
| `app/api/twilio/routing/route.ts` | Update routing. |
| `app/api/twilio/diagnostics/route.ts` | Sanity-check that env vars are set. |

**Tables**
- `phone_number_routing` — `{ phone_number, routing_type, target_user_id }`.

**Permissions**
- `section.twilio_numbers`, leadership only.

---

## 15. Notifications (`/notifications`)

**What the user sees**
- A list of in-app notifications (bell-icon stream).
- Click a notification → marks read + navigates to its `link`.

**Files**
- `app/notifications/page.tsx` — list + mark-read UI.
- The bell icon dropdown lives in `components/TopBar.tsx`.

**Tables**
- `notifications` — `is_read` flag, indexed on `(user_id, is_read)`.

**Permissions**
- Available to everyone signed in.

**Common edits**
- **Add a new notification type.** Just `insert into notifications` from wherever your event happens — see [EDITING-GUIDE Recipe 6](EDITING-GUIDE.md#recipe-6--create-an-in-app-notification).

---

## 16. Settings (`/settings`)

**What the user sees**
- Their profile fields (name, email, phone, avatar).
- Change-password form (requires current password).
- Notification preferences (toggle email categories on/off).
- Disconnect Google Drive button.

**Files**
| File | Role |
|------|------|
| `app/settings/page.tsx` | Server fetch. |
| `app/settings/SettingsForm.tsx` | Client UI. |
| `app/api/users/me/route.ts` | `PATCH` profile fields. |
| `app/api/users/me/password/route.ts` | `PATCH` password (compares current, sets new). |
| `app/api/users/me/google/disconnect/route.ts` | Clears Google tokens. |

**Tables**
- `profiles`.

**Common edits**
- **Add a new preference toggle.** Edit the JSON shape stored in `profiles.notification_preferences` (it's a `jsonb` column — no migration needed for new keys). Show the toggle in `SettingsForm.tsx`. Read it in any email-sending code that should respect it.

---

## 17. Status & Presence (in TopBar)

**What the user sees**
- A status dropdown next to their avatar: Online / On The Line / In Meeting / On Break / Offline.
- A small colored dot on every team member's name elsewhere (synced from this).

**Files**
| File | Role |
|------|------|
| `components/TopBar.tsx` | The dropdown UI. Marks "online" once per session. |
| `app/api/me/status/route.ts` | `GET` returns the whole team list with statuses. `PATCH/POST` updates mine. |

**Tables**
- `profiles.status`, `status_message`, `status_updated_at`.

**Permissions**
- Available to everyone signed in.

**Common edits**
- **Add a new status value** — extend the `STATUSES` array in `TopBar.tsx` and add the new value to the DB CHECK constraint via a migration.
- **Auto-offline after N minutes of inactivity.** Today, status persists until manually changed. To add this: a Vercel Cron that runs `update profiles set status='offline' where status_updated_at < now() - interval '15 minutes'`.
