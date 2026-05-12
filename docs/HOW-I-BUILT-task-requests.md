# How I Built the Task-Requests Feature

> A complete, blow-by-blow record of building a real feature in this codebase.
> Use this as a reference next time you want to build something yourself —
> the order, the decisions, and the file map all transfer to any other feature.

---

## What we built (recap)

A "Request a task" workflow:

- Anyone with `task.request` can submit a task they'd like created. It doesn't become a real task yet — it sits in a pending queue.
- Anyone with `task.approve_requests` (CEO / Owner / Co-Owner / Manager by default) gets an inbox of pending requests.
- **Manager scope:** a manager only sees requests from agents linked to them via `manager_assignments`. Leadership (CEO/Owner/Co-Owner) sees everything.
- Approving creates the real task (linked back to the request) and sends the normal assignment notification + email.
- Denying records a required reason and notifies the requester.
- The requester can cancel their own pending request.
- A red banner shows pending count on the dashboard and `/tasks` page.

---

## The order I did everything (and why)

| # | Step | Why this order |
|---|------|---------------|
| 1 | Decide the data shape | You can't write API/UI until you know what columns and rules exist. |
| 2 | Write the SQL migration | Run it against Supabase before any code talks to it. |
| 3 | Register the new permission keys | The migration seeds them; the TS code references them. Doing both together avoids drift. |
| 4 | Write the API routes | These are the contract the UI consumes. Write + test the backend first; the frontend is "just" a call to it. |
| 5 | Build the page + UI | Server page does the data fetching, the client component handles interactivity. |
| 6 | Integrate the surface (tabs, banner, sidebar) | The feature has to be discoverable. Wire it in last, after it works in isolation. |
| 7 | Type-check | Quick `npx tsc --noEmit` catches dumb mistakes. |
| 8 | Run the migration in Supabase | Only now — by this point the SQL has been read many times. |

**Most important rule:** **don't skip steps 1 or 2.** I've never seen anyone get hurt by spending 10 extra minutes designing the data model. I've seen *lots* of pain caused by writing code before knowing what the columns will be.

---

## Step 1 — Designing the data shape

Before opening any file, I wrote down the answers to these questions:

> **What is a "task request"? What does it know? What states can it be in?**

A task request has:
- The task's *would-be* fields: title, description, priority, deadline, estimated_days.
- A requester (the person asking).
- An assignee (the person it would be assigned to — often = requester).
- Optionally, a specific admin the requester wants to review it.
- A status: `pending → approved` / `denied` / `cancelled`.
- A resolution record: who resolved it, when, why (if denied).
- A pointer back to the actual `tasks` row once approved.

> **Who can see what?**

- Approvers see their inbox (scoped by role).
- Requesters see their own requests in any state.

> **What constraints?**

- Status is an enum: `pending`, `approved`, `denied`, `cancelled`.
- Priority enum matches `tasks.priority` exactly so approval can copy fields 1:1.

That's all the design needed. **15 minutes of writing this down saved me from a dozen wrong commits.**

---

## Step 2 — The SQL migration

**File:** `database/migration-008.sql`

I picked the next number after the highest existing migration (`migration-007.sql` → 008). The pattern in every migration is:

1. Comment block at the top explaining what and why.
2. `create table if not exists` (always `if not exists` so re-running is safe).
3. Indexes for every column the app will filter on.
4. `seed_permission(...)` calls for any new permission keys.

### Choices and trade-offs

- **Used `references profiles(id)` without `on delete cascade`** for `requested_by` and `assigned_to`. Reason: if a user is deactivated, we don't want their request history to disappear.
- **Used `on delete set null`** on `created_task_id`. Reason: a task can be hard-deleted later, but we want the request history intact — just the link broken.
- **A partial index** on `(created_at desc) where status = 'pending'`. Reason: the approver inbox query is `where status='pending' order by created_at desc`. A partial index there is small and fast.
- **`status` is `text` with a CHECK constraint**, not a Postgres enum type. Reason: consistent with the rest of the codebase. Adding a new value is one `alter table` (per `data-model.md § conventions`).
- **`seed_permission`** is the helper from `migration-003.sql` — I reused it rather than writing `insert ... on conflict do nothing` ten times.

### The seed defaults

```sql
-- task.request: most roles
ceo / owner / co-owner / manager / employee / accountant → true
viewer                                                   → false

-- task.approve_requests: admin only
ceo / owner / co-owner / manager → true
everyone else                    → false
```

Manager scope isn't a permission — it's a *query rule* enforced in the API. Permissions answer "can this role do X at all"; scope answers "on which rows." Don't confuse them.

---

## Step 3 — Register the permission keys in TypeScript

**File:** `lib/permissions.ts`

Three additions:

1. **`PERMISSION_KEYS`** — add `'task.request'` and `'task.approve_requests'` to the const array.
2. **`PERMISSION_GROUPS`** — drop them in the existing "Tasks" group so they appear next to the related keys in the admin matrix.
3. **`PERMISSION_LABELS`** — friendly UI strings.

> **Why is this in TS *and* in SQL?** The DB is the source of truth at runtime. The TS array is what makes the keys TYPE-SAFE in your code (autocomplete + compiler check) and what feeds the admin UI's matrix. Both lists must stay in sync — the seed function lives in the migration so SQL doesn't need to know the TS list at runtime, but the TS file needs to know all keys so the admin UI renders them all.

This is the place I most often forget step 3 (the labels). Without labels the admin page still works, but the checkbox shows the raw key like `task.approve_requests`, which looks ugly.

---

## Step 4 — API routes

I built two routes:

### `app/api/task-requests/route.ts`

- **`GET`** — list, with scope enforcement.
- **`POST`** — create a request.

The scope logic in `GET` is the most interesting part. Read this top-to-bottom — it's the pattern for any "leadership sees all, manager sees their team, others see their own" rule:

```ts
const canApprove = await hasPermission(user.role, 'task.approve_requests');

if (mine || !canApprove) {
  // Not an approver, or they asked for "mine" — own requests only
  q = q.eq('requested_by', user.id);
} else if (!isLeadership(user.role)) {
  // Approver but not leadership → manager scope
  const { data: assigns } = await supabaseAdmin
    .from('manager_assignments').select('agent_id').eq('manager_id', user.id);
  const visibleRequesters = [user.id, ...((assigns ?? []).map(a => a.agent_id))];
  const inList = visibleRequesters.map(id => `"${id}"`).join(',');
  q = q.or(`requested_by.in.(${inList}),target_approver.eq.${user.id}`);
}
// else leadership: no filter
```

Three things to notice:

1. **The `.or(...)` syntax is finicky.** Each clause is `column.operator.value`. For an `IN`, it's `column.in.(val1,val2,...)`. Strings have to be double-quoted inside the parens.
2. **We compute `visibleRequesters` in JS** rather than try to express the manager-scope rule as one SQL query. It's two simple queries and reads way clearer.
3. **The `mine || !canApprove` short-circuit** handles the regular-user case naturally. If you're not an approver, you can ONLY see your own requests — same code path as an approver who clicked "My Requests".

### `app/api/task-requests/[id]/route.ts`

- **`PATCH`** with an `action` field: `approve` / `deny` / `cancel`.

Three things this route does that are worth copying for similar features:

1. **Fetch the row first, then check state.** Refuse anything that isn't `pending`. This prevents double-approvals.

2. **The approve action does multiple writes:** create the task, link it back, write the system update on the task, send the assignment notification, notify the requester. I did NOT wrap these in a transaction — Supabase doesn't expose transactions to the JS client. If a later step fails, the earlier writes stay. For non-financial workflows like this, that's an acceptable trade. (For payments etc., use a Postgres function called via `rpc()`.)

3. **Manager-scope check is duplicated** here from the GET route. That's intentional — defense in depth. A manager could try to PATCH a request that wasn't in their list view. The check has to live in both places.

---

## Step 5 — The UI

Split into two files following the standard pattern (server page + client component):

### `app/tasks/requests/page.tsx` (server)

This page does the same scope logic as the GET API — both to render the right data and to keep things fast (no client round-trip to fetch the list on first paint).

A subtlety: the page also computes the **list of eligible approvers** for the "Send to" dropdown in the new-request modal. Eligibility = anyone whose role has `task.approve_requests` enabled. I did this by computing the granular permission for each *distinct role* (not each user) — much fewer queries.

### `app/tasks/requests/TaskRequestsView.tsx` (client)

Holds the modals (new request, deny reason), the action handlers, the filter tabs.

The new-request modal is intentionally similar to the existing `NewTaskForm` so users don't have to learn a new layout — same fields, same priority dropdown, same deadline pattern. The only new field is "Send to (optional)" — leave it blank to broadcast to all eligible approvers, or pick someone specific.

---

## Step 6 — Wiring it into the surface

A feature isn't done until people can find it. I wired it in three places:

1. **Tab on `/tasks`** — a "Requests" link with a red badge showing the pending count (only visible to approvers when there are pending items).
2. **Banner on `/tasks`** — a more prominent red call-to-action box right above the task grid when there's pending stuff to approve.
3. **Banner on the dashboard `/`** — same banner, so admins see it on first nav.

I deliberately did NOT add a separate sidebar entry. Reasons:
- The sidebar is already pretty long.
- Task requests are *part of* the tasks workflow — keeping it under `/tasks/*` and surfacing it from there preserves the mental model.
- The banner-with-count is more eye-catching than another nav item buried in a group.

If you disagree, adding it to the sidebar is one entry in `components/Sidebar.tsx` (see `recipes.md → R27`).

---

## Step 7 — Type-check

```bash
npx tsc --noEmit
```

The only error introduced by my code was a Supabase join-type quirk: `select('...assignee:profiles!fk(...)')` is typed as `assignee: T[]` in the generated types, even though the FK is single-valued so the real return is `assignee: T`. I fixed it with a single `as any` cast at the prop boundary. The cleaner fix would be writing explicit row types, but for one place where the join shape is obvious, the cast is fine.

Pre-existing errors in `TeamManager.tsx`, `PermissionsManager.tsx`, etc. are unrelated to this work and don't block the build (`next.config.js` has `ignoreBuildErrors: true`).

---

## Step 8 — Run the migration

The migration runs in Supabase, not by any automation in this repo.

1. Open Supabase Dashboard → SQL Editor.
2. Paste the entire contents of `database/migration-008.sql`.
3. Click **Run**.
4. Verify:
   ```sql
   select * from task_requests;        -- should exist (empty)
   select role, permission_key, enabled
     from role_permissions
    where permission_key in ('task.request', 'task.approve_requests')
    order by role, permission_key;
   ```

Until this runs, the feature returns 500s because the table doesn't exist. So this is a hard gate before users see anything.

---

## Files touched (the full list)

```
database/migration-008.sql                     NEW   schema + permission seeds
lib/permissions.ts                             EDIT  add 2 keys + labels + group
app/api/task-requests/route.ts                 NEW   GET (list) + POST (create)
app/api/task-requests/[id]/route.ts            NEW   PATCH (approve/deny/cancel)
app/tasks/requests/page.tsx                    NEW   server page for the inbox
app/tasks/requests/TaskRequestsView.tsx        NEW   client UI: list + modals + actions
app/tasks/page.tsx                             EDIT  add "Requests" tab + banner
app/page.tsx                                   EDIT  add dashboard banner
```

8 files, of which 5 are new and 3 are edits. That's a typical mid-size feature — for a really small feature you might only touch 3-4 files; for a big one (e.g. the pipeline), you'd touch 20.

---

## Lessons I'd reapply to future features

### What worked

- **Designed the data first.** Once the columns were on paper, every code question had an obvious answer.
- **Wrote API before UI.** I could mentally test the backend with curl before any UI existed — the UI became "the prettiest way to call these endpoints" instead of "the place where I figure out what I want."
- **Reused existing helpers** — `seed_permission` SQL function, `isLeadership()`, `sendTaskAssignedEmail()`. Even when I had to add a new feature, the surrounding glue was already there.
- **Defense in depth on permissions** — same checks at the page level AND the API level. Stops UI bugs from becoming security bugs.
- **Surfaced it in two places** (banner + tab). Discovery matters more than people give it credit for.

### What I'd watch for

- **Supabase `.or()` syntax is fragile.** If you forget to quote a UUID, the parse silently fails and you get unexpected rows. Print the query string and eyeball it the first time.
- **No transactions.** If I added another step to the approve path (say, posting to Slack), and Slack failed after the task was created, the request would still be marked approved but with a side-effect failure. For higher-stakes flows, push it into a Postgres function and call via `supabaseAdmin.rpc()`.
- **The "any eligible admin" notification fan-out** is O(approvers) inserts into `notifications`. Fine at our scale. If we had hundreds of admins it'd be wasteful — a "queue" pattern with a single row + a join would be better.

---

## The reusable template for "approval workflows"

If you ever want a request-then-approve flow for something else (expenses, time-off, role changes…), here's the pattern in one block:

```
1. Migration:
   - Table with: actor (who asked), target (what/who it affects),
     payload (the fields it would create), status (pending/approved/denied/cancelled),
     resolver (who acted on it), resolved_at, denial_reason, linked_resource_id.
   - Indexes on status, actor, and a partial index on pending.
   - Seed two permissions: <thing>.request and <thing>.approve_requests.

2. lib/permissions.ts:
   - Add the two keys, labels, and group.

3. app/api/<thing>-requests/route.ts:
   - GET with scope filter (leadership all / manager team / others self).
   - POST that inserts + notifies approvers.

4. app/api/<thing>-requests/[id]/route.ts:
   - PATCH with action: approve / deny / cancel.
   - approve creates the real resource + links it back.
   - deny requires a reason + notifies requester.
   - cancel only by requester, only while pending.

5. app/<thing>s/requests/page.tsx + RequestsView.tsx:
   - Same shape as task requests — filter tabs, cards, modals.

6. Surface it: tab on the parent page + banner on dashboard.

7. Type-check, run migration, test.
```

Every "approval" feature in any web app fits in those 7 steps. The only thing that changes is the payload shape.
