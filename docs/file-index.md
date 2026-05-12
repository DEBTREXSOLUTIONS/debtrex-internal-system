# File Index — Every File Mapped to Its Purpose

When you don't know which file to edit, search this page first.

---

## Top-level config

| File | What it does | Edit when |
|------|--------------|-----------|
| `package.json` | Dependencies + npm scripts | Adding/removing a library |
| `next.config.js` | Next.js build options (TS-ignore, image domains, headers, bundle optimizations) | Tuning build behavior |
| `tailwind.config.js` | Tailwind CSS palette + font setup | Adding a brand color, changing fonts |
| `postcss.config.js` | PostCSS pipeline for Tailwind | Almost never |
| `tsconfig.json` | TypeScript compiler options | Almost never |
| `middleware.ts` | The cookie gate — runs before every request | Whitelisting a new public path (Twilio webhook, cron, etc.) |
| `next-env.d.ts` | Next.js TS types | Never (auto-managed) |
| `.env.example` | Template for environment variables | Adding a new secret |
| `README.md` | Operator/setup guide | Changing install steps |
| `HOW-TO-APPLY.txt` | Quick deployment notes | Updating deploy procedure |

---

## `app/` — pages + API routes

### Root pages

| Path | File | Notes |
|------|------|-------|
| `/` | `app/page.tsx` | Dashboard. KPI cards + task list + today's events. Pure server component. |
| `/login` | `app/login/page.tsx` | The only un-authed page. Has a client form. |
| Root layout | `app/layout.tsx` | `<html><body>` wrapper. Don't put auth here — pages handle it. |
| Global styles | `app/globals.css` | Tailwind base + brand custom CSS (`.btn-primary`, `.card`, etc). |

### Tasks (`/tasks`)

| Path | File | Notes |
|------|------|-------|
| List | `app/tasks/page.tsx` | Filter tabs by query string. |
| New | `app/tasks/new/page.tsx` + `NewTaskForm.tsx` | Server page + client form. |
| Detail | `app/tasks/[id]/page.tsx` | Joins task + updates + notes. |
| Detail tracker | `app/tasks/[id]/TaskWorkTracker.tsx` | Client component — status toggle + work log. |

### Calendar (`/calendar`)

| Path | File | Notes |
|------|------|-------|
| Page | `app/calendar/page.tsx` | Fetches ± 6 months. |
| UI | `app/calendar/CalendarView.tsx` | Client wrapper around FullCalendar. |

### Pipeline (`/pipeline/*`)

| Path | File | Notes |
|------|------|-------|
| Sales list | `app/pipeline/sales/page.tsx` | Calls `<PipelinePageBase pipeline_type="sales">`. |
| Mgmt list | `app/pipeline/management/page.tsx` | Same with `"management"`. |
| Sales detail | `app/pipeline/sales/[id]/page.tsx` | Calls `<ContactDetailBase>`. |
| Mgmt detail | `app/pipeline/management/[id]/page.tsx` | Same. |
| Shared list page | `app/pipeline/PipelinePageBase.tsx` | Server. |
| Shared list UI | `app/pipeline/PipelineList.tsx` | Client. Holds add-contact form + filters. |
| Shared detail page | `app/pipeline/ContactDetailBase.tsx` | Server. |
| Shared detail UI | `app/pipeline/ContactDetail.tsx` | Client. Notes, calls, collaborators. |

### Budget (`/budget`)

| Path | File | Notes |
|------|------|-------|
| Dashboard page | `app/budget/page.tsx` | Server fetch. |
| Dashboard UI | `app/budget/BudgetDashboard.tsx` | Client. Charts + lists. |
| Allocations page | `app/budget/allocations/page.tsx` | Server. |
| Allocations UI | `app/budget/allocations/BudgetAllocations.tsx` | Client. Per-month, per-category editor. |

### Calculators (`/calculators`)

| Path | File | Notes |
|------|------|-------|
| Page | `app/calculators/page.tsx` | Wrapper. |
| Tab switcher | `app/calculators/CalculatorsView.tsx` | Client. |
| DTI tool | `app/calculators/DTICalculator.tsx` | Client. |
| Budget tool | `app/calculators/BudgetCalculator.tsx` | Client. |

### Files (`/files`)

| Path | File | Notes |
|------|------|-------|
| Page | `app/files/page.tsx` | Checks if Drive is connected. |
| UI | `app/files/FilesView.tsx` | Client. Upload + list. |

### Team (`/team`)

| Path | File | Notes |
|------|------|-------|
| Page | `app/team/page.tsx` | Server. |
| UI | `app/team/TeamManager.tsx` | Client. Invite + role-change controls. |

### Performance (`/performance`)

| Path | File | Notes |
|------|------|-------|
| Page | `app/performance/page.tsx` | Server. Routes to assigned-only for managers. |
| UI | `app/performance/PerformanceView.tsx` | Client. Leaderboards. |
| Assignments page | `app/performance/assignments/page.tsx` | Server. |
| Assignments UI | `app/performance/assignments/AssignmentsManager.tsx` | Client. |

### Settings (`/settings`)

| Path | File | Notes |
|------|------|-------|
| Page | `app/settings/page.tsx` | Server. |
| Form | `app/settings/SettingsForm.tsx` | Client. Profile + password + notifications. |

### Admin pages

| Path | File | Notes |
|------|------|-------|
| Permissions page | `app/permissions/page.tsx` | Server. |
| Permissions UI | `app/permissions/PermissionsManager.tsx` | Client matrix. |
| Roles page | `app/roles/page.tsx` | Server. |
| Roles UI | `app/roles/RolesManager.tsx` | Client. |
| Twilio numbers page | `app/twilio-numbers/page.tsx` | Server. |
| Twilio numbers UI | `app/twilio-numbers/TwilioNumbersManager.tsx` | Client. |

### Notifications

| Path | File | Notes |
|------|------|-------|
| Page | `app/notifications/page.tsx` | Server. |

---

## `app/api/` — backend routes

### Auth

| Endpoint | File | Method | Notes |
|----------|------|--------|-------|
| `/api/auth/login` | `app/api/auth/login/route.ts` | POST | Validates pwd, sets cookie. |
| `/api/auth/logout` | `app/api/auth/logout/route.ts` | POST | Clears cookie. |
| `/api/auth/setup` | `app/api/auth/setup/route.ts` | POST | First CEO only. |

### "Me" routes

| Endpoint | File | Method |
|----------|------|--------|
| `/api/me/permissions` | `app/api/me/permissions/route.ts` | GET |
| `/api/me/status` | `app/api/me/status/route.ts` | GET / PATCH / POST |
| `/api/users/me` | `app/api/users/me/route.ts` | PATCH |
| `/api/users/me/password` | `app/api/users/me/password/route.ts` | PATCH |
| `/api/users/me/google/disconnect` | `app/api/users/me/google/disconnect/route.ts` | POST |

### Tasks

| Endpoint | File | Method |
|----------|------|--------|
| `/api/tasks` | `app/api/tasks/route.ts` | POST |
| `/api/tasks/[id]` | `app/api/tasks/[id]/route.ts` | PATCH |
| `/api/tasks/[id]/updates` | `app/api/tasks/[id]/updates/route.ts` | POST |
| `/api/tasks/[id]/notes` | `app/api/tasks/[id]/notes/route.ts` | POST |

### Events

| Endpoint | File | Method |
|----------|------|--------|
| `/api/events` | `app/api/events/route.ts` | POST |

### Pipeline

| Endpoint | File | Method |
|----------|------|--------|
| `/api/pipeline` | `app/api/pipeline/route.ts` | POST |
| `/api/pipeline/[id]` | `app/api/pipeline/[id]/route.ts` | PATCH, DELETE |
| `/api/pipeline/[id]/calls` | `app/api/pipeline/[id]/calls/route.ts` | POST |
| `/api/pipeline/[id]/notes` | `app/api/pipeline/[id]/notes/route.ts` | POST |
| `/api/pipeline/notes/[id]` | `app/api/pipeline/notes/[id]/route.ts` | PATCH, DELETE |
| `/api/pipeline/[id]/collaborators` | `app/api/pipeline/[id]/collaborators/route.ts` | GET, POST |
| `/api/pipeline/collaborators/[collabId]` | `app/api/pipeline/collaborators/[collabId]/route.ts` | DELETE |

### Budget

| Endpoint | File | Method |
|----------|------|--------|
| `/api/budgets` | `app/api/budgets/route.ts` | POST |
| `/api/budgets/[id]` | `app/api/budgets/[id]/route.ts` | DELETE |
| `/api/budgets/copy-previous` | `app/api/budgets/copy-previous/route.ts` | POST |
| `/api/expenses` | `app/api/expenses/route.ts` | POST |
| `/api/expenses/[id]` | `app/api/expenses/[id]/route.ts` | PATCH |
| `/api/income` | `app/api/income/route.ts` | POST |

### Files & Google

| Endpoint | File | Method |
|----------|------|--------|
| `/api/google/auth` | `app/api/google/auth/route.ts` | GET (redirect) |
| `/api/google/callback` | `app/api/google/callback/route.ts` | GET (Google calls) |
| `/api/files/upload` | `app/api/files/upload/route.ts` | POST |
| `/api/files/[id]` | `app/api/files/[id]/route.ts` | DELETE |

### Users / Team

| Endpoint | File | Method |
|----------|------|--------|
| `/api/users/invite` | `app/api/users/invite/route.ts` | POST |
| `/api/users/[id]` | `app/api/users/[id]/route.ts` | PATCH |
| `/api/users/[id]/twilio-number` | `app/api/users/[id]/twilio-number/route.ts` | PATCH |

### Roles / Permissions admin

| Endpoint | File | Method |
|----------|------|--------|
| `/api/roles` | `app/api/roles/route.ts` | POST |
| `/api/roles/[key]` | `app/api/roles/[key]/route.ts` | PATCH, DELETE |
| `/api/permissions` | `app/api/permissions/route.ts` | POST |

### Performance

| Endpoint | File | Method |
|----------|------|--------|
| `/api/manager-assignments` | `app/api/manager-assignments/route.ts` | POST |
| `/api/manager-assignments/[id]` | `app/api/manager-assignments/[id]/route.ts` | DELETE |

### Calculators

| Endpoint | File | Method |
|----------|------|--------|
| `/api/calculations` | `app/api/calculations/route.ts` | POST |
| `/api/calculations/[id]` | `app/api/calculations/[id]/route.ts` | PATCH, DELETE |

### Twilio — browser side

| Endpoint | File | Method | Notes |
|----------|------|--------|-------|
| `/api/twilio/voice-token` | `app/api/twilio/voice-token/route.ts` | GET | Mints Voice SDK JWT. |
| `/api/twilio/call` | `app/api/twilio/call/route.ts` | POST | Server-initiated call. |
| `/api/twilio/diagnostics` | `app/api/twilio/diagnostics/route.ts` | GET | Sanity-check env vars. |
| `/api/twilio/log-browser-call` | `app/api/twilio/log-browser-call/route.ts` | POST | After browser call ends. |
| `/api/twilio/routing` | `app/api/twilio/routing/route.ts` | POST | Set inbound routing for a number. |
| `/api/twilio/recordings/[id]` | `app/api/twilio/recordings/[id]/route.ts` | GET | Proxy a recording with auth. |

### Twilio — webhook side (public, called by Twilio)

| Endpoint | File | Method | Notes |
|----------|------|--------|-------|
| `/api/twilio/twiml/dial` | `app/api/twilio/twiml/dial/route.ts` | POST, GET | TwiML for outbound bridge. |
| `/api/twilio/status` | `app/api/twilio/status/route.ts` | POST | Call lifecycle. |
| `/api/twilio/recording` | `app/api/twilio/recording/route.ts` | POST | Recording ready. |
| `/api/twilio/amd` | `app/api/twilio/amd/route.ts` | POST | Answering-machine detection. |
| `/api/twilio/voice-twiml` | `app/api/twilio/voice-twiml/route.ts` | POST, GET | Browser identity TwiML. |
| `/api/twilio/inbound` | `app/api/twilio/inbound/route.ts` | POST, GET | Primary inbound — selects target. |
| `/api/twilio/inbound-fallback` | `app/api/twilio/inbound-fallback/route.ts` | POST, GET | Fallback if `/inbound` errors. |
| `/api/twilio/voicemail` | `app/api/twilio/voicemail/route.ts` | POST | Voicemail recording callback. |

All Twilio webhooks are whitelisted in `middleware.ts → TWILIO_WEBHOOK_PREFIXES`.

---

## `components/` — shared client components

| File | Purpose |
|------|---------|
| `Sidebar.tsx` | Left nav. Renders permission-gated nav items. Mounts `InboundCallListener`. |
| `TopBar.tsx` | Header. Title + bell + status dropdown + (presence). |
| `BrowserDialer.tsx` | Floating outbound-call widget. Embed it in any page that needs it. |
| `InboundCallListener.tsx` | Invisible. Connects to Twilio Voice SDK; pops a toast on inbound. |

---

## `lib/` — server-side utilities

| File | Has `'server-only'`? | Purpose |
|------|----------------------|---------|
| `auth.ts` | Yes | `getCurrentUser`, JWT sign/verify, cookie helpers, password hash. |
| `roles.ts` | **No** — safe on client | Hard-coded role helpers like `canManageUsers()`. |
| `permissions.ts` | Yes | `hasPermission()`, `getPermissions()`, the key list, cache. |
| `supabase.ts` | No (but uses service key) | Exports `supabase` (anon) and `supabaseAdmin` (service). |
| `email.ts` | No (but reads RESEND_API_KEY) | All email templates + `sendEmail`. |
| `google-drive.ts` | Yes | OAuth flow + Drive REST. |
| `twilio.ts` | Yes | Twilio REST client + helpers. |
| `twilio-voice.ts` | Yes | Voice SDK JWT minting. |
| `performance.ts` | Yes | KPI computations. |

**Rule:** never import a `server-only` file from a `"use client"` component. If you need role checks in the browser, use `lib/roles.ts`.

---

## `database/` — SQL

| File | Purpose | When to edit |
|------|---------|--------------|
| `schema.sql` | Initial install snapshot | Almost never. Used when setting up a fresh Supabase project. |
| `migration-002.sql` through `migration-007.sql` | Past changes in order | Never edit — they were already run in production. |
| `migration-NNN.sql` (new) | Add new changes here | Every time you change the schema. |

---

## `docs/` — you are here

| File | Purpose |
|------|---------|
| `README.md` | Doc index. |
| `EDITING-GUIDE.md` | The master "how to edit" doc. **Start here.** |
| `feature-walkthroughs.md` | Every feature explained. |
| `recipes.md` | Copy-paste templates. |
| `file-index.md` | This file. |
| `architecture.md` | High-level architecture. |
| `data-model.md` | DB tables and relationships. |
| `auth-and-permissions.md` | Auth & permission deep-dive. |
| `api-reference.md` | API at a glance. |
| `dev-workflow.md` | Running locally, common tasks. |
| `performance.md` | Perf notes — what was slow, what was fixed. |
| `troubleshooting.md` | Error → cause → fix. |
| `ui-and-styling.md` | Tailwind setup, brand classes, component patterns. |
