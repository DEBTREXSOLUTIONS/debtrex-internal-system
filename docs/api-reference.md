# API Reference

Every route lives under `app/api/<path>/route.ts`. The file's exported function names (`GET`, `POST`, `PATCH`, `DELETE`) define which HTTP methods it accepts. All routes (except those whitelisted in `middleware.ts`) require a valid `debtrex_session` cookie.

Status codes used: `200` (success), `400` (bad input), `401` (no session), `403` (forbidden), `404` (not found), `500` (server error).

## Auth

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/auth/login` | Validate email/password, set session cookie | Public |
| POST | `/api/auth/logout` | Clear session cookie | Public |
| POST | `/api/auth/setup` | Create first CEO. Only works when no users exist. | Public |

## Current user (me)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/me/permissions` | Return calling user's flat permission map | Any signed-in |
| GET | `/api/me/status` | Get my status + team status list | Any signed-in |
| PATCH | `/api/me/status` | Update my online/OTL/meeting/break/offline status | Any signed-in |
| POST | `/api/me/status` | Same as PATCH (alt for `navigator.sendBeacon`) | Any signed-in |
| PATCH | `/api/users/me` | Update my profile (name, phone, etc.) | Any signed-in |
| PATCH | `/api/users/me/password` | Change my password (requires current password) | Any signed-in |
| POST | `/api/users/me/google/disconnect` | Revoke my stored Google Drive tokens | Any signed-in |

## Tasks

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/tasks` | Create a task | `task.create` |
| PATCH | `/api/tasks/[id]` | Update title/status/deadline/etc. | `task.edit_any` or task ownership |
| POST | `/api/tasks/[id]/updates` | Add a work-log update (hours, status) | Assignee |
| POST | `/api/tasks/[id]/notes` | Add a discussion note | Assignee or creator |

Task deletion is not currently exposed via API — tasks are kept for history. Use status `cancelled` to retire one.

## Events / Calendar

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/events` | Create a calendar event (+ attendees) | `event.create` |

Edit / delete of events are not currently exposed via API; create-only workflow.

## Pipeline (Management + Sales)

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/pipeline` | Create a contact (pass `pipeline_type`) | `pipeline.create` |
| PATCH | `/api/pipeline/[id]` | Update contact fields | `pipeline.edit_any` or owner/collaborator |
| DELETE | `/api/pipeline/[id]` | Delete contact | `pipeline.delete` |
| POST | `/api/pipeline/[id]/calls` | Log a manual call attempt | `call.log` |
| POST | `/api/pipeline/[id]/notes` | Add a sticky note | `call.log` (or owner) |
| PATCH | `/api/pipeline/notes/[id]` | Edit a note | Note author |
| DELETE | `/api/pipeline/notes/[id]` | Delete a note | Note author or leadership |
| GET | `/api/pipeline/[id]/collaborators` | List collaborators on a contact | Anyone with contact access |
| POST | `/api/pipeline/[id]/collaborators` | Add a collaborator | Contact owner or `pipeline.assign_to_anyone` |
| DELETE | `/api/pipeline/collaborators/[collabId]` | Remove a collaborator | Contact owner or `pipeline.assign_to_anyone` |

## Budget

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/budgets` | Create a monthly allocation `(month, category, amount)` | `budget.edit_allocations` |
| DELETE | `/api/budgets/[id]` | Remove an allocation | `budget.edit_allocations` |
| POST | `/api/budgets/copy-previous` | Copy last month's allocations into this month | `budget.edit_allocations` |
| POST | `/api/expenses` | Submit an expense | `expense.submit` |
| PATCH | `/api/expenses/[id]` | Approve/reject/edit | `expense.approve` (for approvals) |
| POST | `/api/income` | Record income | `income.record` |

## Files (Google Drive)

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| GET | `/api/google/auth` | Start OAuth — redirects to Google consent screen | Any signed-in |
| GET | `/api/google/callback` | OAuth landing — exchanges code, stores tokens on profile | Public (Google → our server) |
| POST | `/api/files/upload` | Upload a file to caller's Drive folder | Any signed-in with Drive connected |
| DELETE | `/api/files/[id]` | Delete a file from Drive | File owner |

## Users / Team

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/users/invite` | Create a new user, send invite email with temp password | `team.invite` |
| PATCH | `/api/users/[id]` | Update role / active flag / fields | `team.change_roles` / `team.deactivate` |
| PATCH | `/api/users/[id]/twilio-number` | Assign a Twilio number to a user | Leadership |

## Roles (custom)

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/roles` | Create a custom role | `roles.manage` |
| PATCH | `/api/roles/[key]` | Rename / re-color a custom role | `roles.manage` |
| DELETE | `/api/roles/[key]` | Delete a custom role (built-ins protected) | `roles.manage` |

## Permissions admin

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/permissions` | Bulk-update the `role_permissions` matrix | `permissions.manage` |

After any change, the server calls `invalidatePermissionCache()` so the next request reads fresh data.

## Performance / Manager assignments

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/manager-assignments` | Assign an agent to a manager | `performance.assign_managers` |
| DELETE | `/api/manager-assignments/[id]` | Remove an assignment | `performance.assign_managers` |

## Calculators

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/calculations` | Save a calculator result | Any signed-in |
| PATCH | `/api/calculations/[id]` | Rename / edit a saved result | Owner |
| DELETE | `/api/calculations/[id]` | Delete a saved result | Owner |

## Twilio (browser-call related)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/twilio/voice-token` | Mint a short-lived JWT for the browser Voice SDK | `call.make` |
| POST | `/api/twilio/call` | Initiate a server-side outbound call (non-browser) | `call.make` |
| GET | `/api/twilio/diagnostics` | Check Twilio config (returns booleans, no secrets) | Leadership |
| POST | `/api/twilio/log-browser-call` | Persist call_log row after a browser Voice call ends | Any signed-in |
| POST | `/api/twilio/routing` | Configure inbound routing for a number | Leadership |
| GET | `/api/twilio/recordings/[id]` | Stream a recording (proxied with auth) | Call participants or leadership |

## Twilio webhooks — these are PUBLIC (called by Twilio's servers)

These are whitelisted in `middleware.ts`. **In production, validate the `X-Twilio-Signature` header** before trusting the body (currently not enforced — see TODO in middleware.ts).

| Method | Path | Purpose |
|--------|------|---------|
| POST, GET | `/api/twilio/twiml/dial` | TwiML for outbound bridge |
| POST | `/api/twilio/status` | Call lifecycle status callbacks |
| POST | `/api/twilio/recording` | Recording-ready callback |
| POST | `/api/twilio/amd` | Answering-machine detection result |
| POST, GET | `/api/twilio/voice-twiml` | Inbound TwiML for browser identity |
| POST, GET | `/api/twilio/inbound` | Primary inbound webhook — selects routing target |
| POST, GET | `/api/twilio/inbound-fallback` | If inbound fails |
| POST | `/api/twilio/voicemail` | Voicemail recording callback |

## Conventions for new routes

```ts
// app/api/<feature>/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const BodySchema = z.object({
  title: z.string().min(1),
  // ...
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await hasPermission(user.role, 'task.create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = BodySchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({ ...body.data, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

Three things to remember:
1. **Auth check first**, before any DB work.
2. **Validate input** with `zod`. Don't trust the body shape.
3. **Use `supabaseAdmin`** server-side. The anon client is for client-side reads that don't exist much in this app.
