# The Editing Guide — How to Add and Edit Functions Yourself

> This is the master document. If you read only one doc, read this one.
> It teaches you the mental model, the file map, and the exact recipes
> for the changes you'll make 95% of the time.

---

## Table of contents

1. [The mental model in 60 seconds](#1-the-mental-model-in-60-seconds)
2. [The 3 layers you'll touch](#2-the-3-layers-youll-touch)
3. [Project file map — every folder explained](#3-project-file-map--every-folder-explained)
4. [The standard request lifecycle (what happens when a user clicks)](#4-the-standard-request-lifecycle)
5. [How a page is built (anatomy)](#5-how-a-page-is-built-anatomy)
6. [How an API route is built (anatomy)](#6-how-an-api-route-is-built-anatomy)
7. [The permission system, end to end](#7-the-permission-system-end-to-end)
8. [Database — how to read and change it](#8-database--how-to-read-and-change-it)
9. [Server components vs client components — the cheat sheet](#9-server-components-vs-client-components)
10. [The Supabase query language you actually need](#10-the-supabase-query-language-you-actually-need)
11. [The 12 most common edits (recipes)](#11-the-12-most-common-edits-recipes)
12. [Adding a brand-new feature from scratch](#12-adding-a-brand-new-feature-from-scratch)
13. [Common errors and what they mean](#13-common-errors-and-what-they-mean)
14. [Glossary](#14-glossary)

---

## 1. The mental model in 60 seconds

DEBTREX is **one Next.js app** that serves both the website (pages) and the backend (API). They live in the **same folder** — `app/`. The split is just by filename:

- `app/.../page.tsx` → a webpage someone visits in the browser.
- `app/api/.../route.ts` → an HTTP endpoint that returns JSON.

Both run on the server first. Both use the same auth system, the same database, the same helpers. Code in `lib/` is shared utilities. Code in `components/` is shared React UI.

The database is **PostgreSQL on Supabase**. We talk to it through `supabaseAdmin` — a server-side client that bypasses any row-level security. **Security is enforced in our TypeScript code**, not at the DB level. That means every API route MUST check who's calling and whether they're allowed.

Authentication is **a cookie called `debtrex_session`**, which contains a signed JWT (basically a tamper-proof ID card). Every request shows this cookie at the door (`middleware.ts`), and every page/route re-checks it via `getCurrentUser()`.

That's it. Everything else is detail.

---

## 2. The 3 layers you'll touch

When you add or edit a "function" (in the website sense — a feature), you'll usually touch some combination of three layers:

```
┌────────────────────────────────────────────────────────────┐
│  LAYER 1 — UI                                              │
│  app/<thing>/page.tsx          ← server-rendered page      │
│  app/<thing>/SomeForm.tsx      ← client interactivity      │
│  components/Sidebar.tsx        ← nav link                  │
└────────────────────────────────────────────────────────────┘
                          ↓ user clicks "Save"
                          ↓ fetch('/api/things', { method: 'POST' })
┌────────────────────────────────────────────────────────────┐
│  LAYER 2 — API                                             │
│  app/api/<thing>/route.ts      ← validates & runs the work │
│      ├─ getCurrentUser()       ← who is calling            │
│      ├─ hasPermission(...)     ← are they allowed          │
│      └─ supabaseAdmin.from()   ← read or write the DB      │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│  LAYER 3 — DATABASE                                        │
│  database/schema.sql           ← initial install reference │
│  database/migration-NNN.sql    ← every change since then   │
└────────────────────────────────────────────────────────────┘
```

**Rule of thumb for which layers to touch:**

| What you're doing | Layers |
|---|---|
| Rename a button label | 1 only |
| Add a new field to a form (saves to existing column) | 1 |
| Add a new field that needs storage | 1 + 2 + 3 |
| Allow a new role to access an existing page | nothing — toggle in `/permissions` UI |
| Add a new permission key | 1 (`lib/permissions.ts` + admin UI) + 2 (use it) + 3 (seed it) |
| Add a whole new module | all 3 |

---

## 3. Project file map — every folder explained

```
debtrex-system/
│
├── app/                   ← THE WHOLE WEBSITE. Pages + API.
│   │
│   ├── api/               ← Backend HTTP endpoints
│   │   ├── auth/          ← login, logout, first-CEO setup
│   │   ├── budgets/       ← monthly budget allocations
│   │   ├── calculations/  ← saved calculator scenarios
│   │   ├── events/        ← calendar events
│   │   ├── expenses/      ← expense submit / approve
│   │   ├── files/         ← Google Drive upload / delete
│   │   ├── google/        ← OAuth start + callback
│   │   ├── income/        ← record income
│   │   ├── manager-assignments/ ← manager↔agent links
│   │   ├── me/            ← stuff about the calling user (permissions, status)
│   │   ├── permissions/   ← bulk-update role permission matrix
│   │   ├── pipeline/      ← contacts, notes, collaborators, call logs
│   │   ├── roles/         ← create / edit / delete custom roles
│   │   ├── tasks/         ← task CRUD + updates + notes
│   │   ├── twilio/        ← phone calls — see the Twilio guide
│   │   └── users/         ← invite, edit, deactivate, change role
│   │
│   ├── login/             ← /login page (the only un-authed page)
│   ├── page.tsx           ← / (the dashboard)
│   ├── tasks/             ← /tasks list, /tasks/[id], /tasks/new
│   ├── calendar/          ← /calendar
│   ├── files/             ← /files
│   ├── budget/            ← /budget + /budget/allocations
│   ├── calculators/       ← /calculators (DTI + budget calculators)
│   ├── pipeline/          ← /pipeline/sales/* and /pipeline/management/*
│   ├── performance/       ← /performance + /performance/assignments
│   ├── permissions/       ← /permissions admin (toggle the matrix)
│   ├── roles/             ← /roles admin (create custom roles)
│   ├── team/              ← /team — invite / deactivate members
│   ├── twilio-numbers/    ← /twilio-numbers admin
│   ├── settings/          ← /settings (current user's profile)
│   ├── notifications/     ← /notifications inbox
│   ├── layout.tsx         ← root HTML shell (just <html><body>)
│   └── globals.css        ← Tailwind base + brand custom CSS
│
├── components/            ← Shared client components used across pages
│   ├── Sidebar.tsx        ← the left navigation; reads permissions
│   ├── TopBar.tsx         ← header bar with status dropdown
│   ├── BrowserDialer.tsx  ← in-browser Twilio outbound call widget
│   └── InboundCallListener.tsx ← invisible mount that receives inbound calls
│
├── lib/                   ← Shared server-side utilities (SECRETS HERE)
│   ├── auth.ts            ← getCurrentUser, JWT sign/verify, cookie helpers
│   ├── roles.ts           ← canManageUsers(), canEditBudget(), etc — safe on client too
│   ├── permissions.ts     ← hasPermission(), getPermissions() + permission key list
│   ├── supabase.ts        ← the two DB clients (anon + admin)
│   ├── email.ts           ← Resend wrapper + every email template
│   ├── google-drive.ts    ← Drive OAuth + upload/download
│   ├── twilio.ts          ← server-side Twilio REST helpers
│   ├── twilio-voice.ts    ← browser Voice SDK token minting
│   └── performance.ts     ← KPI calculations for the performance page
│
├── database/
│   ├── schema.sql         ← INITIAL install (reference snapshot)
│   └── migration-NNN.sql  ← every change applied after launch, in order
│
├── middleware.ts          ← the door — runs before every request, gates by cookie
├── next.config.js         ← Next.js build settings
├── tailwind.config.js     ← Tailwind palette (brand-red, brand-ink, etc.)
├── package.json           ← dependencies + npm scripts
└── docs/                  ← you are here
```

### What about `node_modules/` and `.next/`?

You never edit those. `node_modules/` is your installed dependencies (managed by `npm install`). `.next/` is Next.js's build cache (delete it if dev mode acts weird; it'll rebuild).

---

## 4. The standard request lifecycle

Whenever a user clicks anything, this is what happens. Memorize the shape:

### A) When they navigate to a page (e.g. `/tasks`)

```
Browser  →  GET /tasks
   │
   ├─ middleware.ts                ← reads `debtrex_session` cookie
   │     ├─ no cookie? → redirect to /login
   │     ├─ bad cookie? → redirect to /login
   │     └─ good cookie → continue
   │
   ├─ app/tasks/page.tsx           ← server React component, async
   │     ├─ getCurrentUser()       ← re-verifies JWT and re-fetches profile
   │     ├─ (optional) permission check → redirect('/') if denied
   │     ├─ supabaseAdmin.from('tasks').select(...)   ← runs queries
   │     └─ returns JSX with the data
   │
   ├─ HTML streams back to the browser
   └─ Client components ("use client") hydrate for interactivity
```

### B) When their form makes an API call (e.g. POST `/api/tasks`)

```
Browser  →  fetch('/api/tasks', { method: 'POST', body: JSON })
   │
   ├─ middleware.ts                ← same cookie check; returns 401 JSON if denied
   │
   ├─ app/api/tasks/route.ts       ← exported `POST` function runs
   │     ├─ getCurrentUser()       ← returns 401 if null
   │     ├─ hasPermission(...)     ← returns 403 if false (sometimes)
   │     ├─ validate body          ← reject 400 if input is wrong
   │     ├─ supabaseAdmin.insert() ← do the write
   │     ├─ side effects           ← send email, write audit_log, create notification
   │     └─ return NextResponse.json(data)
   │
   └─ Browser gets back JSON; usually re-renders or router.refresh()
```

This pattern repeats **everywhere**. Once you've seen it twice, you can read any route in the project.

---

## 5. How a page is built (anatomy)

Every page in `app/<route>/page.tsx` looks roughly the same. Here's the canonical pattern, annotated.

```tsx
// app/widgets/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import WidgetForm from './WidgetForm';   // client component, see step 5b

// 1. The default export is the page. It's an ASYNC function — that's what
//    makes this a Server Component. Async + no "use client" = runs on server.
export default async function WidgetsPage() {

  // 2. Auth: who is asking? Redirect if not signed in.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // 3. Permission: can they even see this page? Redirect home if not.
  //    (We "use the granular system OR fall back to a hard-coded helper".)
  const allowed = await hasPermission(user.role, 'section.widgets');
  if (!allowed) redirect('/');

  // 4. Fetch your data. Use Promise.all to parallelize independent queries.
  const [widgetsRes, peopleRes] = await Promise.all([
    supabaseAdmin
      .from('widgets')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200),                            // always bound the result set
    supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true),
  ]);

  const widgets = widgetsRes.data || [];
  const people  = peopleRes.data  || [];

  // 5. Return the JSX. Sidebar + TopBar are reused on every page.
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Widgets" />
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">

          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-condensed text-2xl font-black uppercase">All Widgets</h1>
            <Link href="/widgets/new" className="btn-primary">
              <Plus size={14} /> New Widget
            </Link>
          </div>

          {/* List */}
          {widgets.length === 0 ? (
            <p className="text-gray-500">No widgets yet.</p>
          ) : (
            <ul>
              {widgets.map(w => <li key={w.id}>{w.name}</li>)}
            </ul>
          )}

          {/* Interactive form is a client component — see below */}
          <WidgetForm people={people} />
        </div>
      </main>
    </div>
  );
}
```

### 5b. The client component (`WidgetForm.tsx`)

Whenever you need `useState`, `useEffect`, event handlers, or anything reactive, that piece must be a Client Component. Mark it with `"use client"` at the very top.

```tsx
// app/widgets/WidgetForm.tsx
"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WidgetForm({ people }: { people: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/widgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to save');
      return;
    }
    setName('');
    router.refresh();   // re-runs the server component → shows the new widget
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 mt-6">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Widget name"
        className="input"
      />
      <button type="submit" disabled={saving} className="btn-primary mt-3">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
```

**Why split into two files?** Server components can be `async` and talk to the DB. Client components can have state and handlers. You can't do both in one component. So the pattern is: server page fetches data, passes it as props to a client component.

---

## 6. How an API route is built (anatomy)

Every API endpoint lives at `app/api/<path>/route.ts`. The file's exports define which HTTP verbs work:

```ts
export async function GET(req)    { ... }
export async function POST(req)   { ... }
export async function PATCH(req)  { ... }
export async function DELETE(req) { ... }
```

Here's the canonical POST route, fully annotated:

```ts
// app/api/widgets/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  // 1. AUTH — always first.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. PERMISSION — always second.
  if (!(await hasPermission(user.role, 'widget.create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. PARSE + VALIDATE input. Never trust the body shape.
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, color } = body;
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // 4. DO THE WORK. supabaseAdmin = service-role; bypasses RLS.
  const { data, error } = await supabaseAdmin
    .from('widgets')
    .insert({
      name,
      color: color || 'gray',
      created_by: user.id,         // always stamp who did it
    })
    .select()                       // return the new row
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 5. SIDE EFFECTS — audit log, notifications, emails. Optional.
  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'widget_created',
    resource_type: 'widget',
    resource_id: data.id,
    details: { name },
  });

  // 6. RETURN. Always JSON.
  return NextResponse.json(data);
}
```

### Dynamic routes (the `[id]` thing)

If your URL has an ID in it (`/api/widgets/abc-123`), the file goes at `app/api/widgets/[id]/route.ts`. You read the ID from `params`:

```ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }   // Next.js 15 wraps params in a Promise
) {
  const { id } = await params;
  // ... rest of the handler ...
}
```

### Status codes — keep it simple

| Code | Meaning | When to use |
|------|---------|-------------|
| 200 | OK | Success — return JSON |
| 400 | Bad Request | The body is wrong / missing fields |
| 401 | Unauthorized | No cookie / invalid cookie |
| 403 | Forbidden | Logged in but not allowed |
| 404 | Not Found | The resource doesn't exist |
| 500 | Server Error | The DB failed, or anything we didn't anticipate |

---

## 7. The permission system, end to end

There are **three different "permission" mechanisms** in the codebase. They sound similar but solve different problems. **Memorize this section** — it's where most confusion lives.

### 7.1 Built-in role helpers (`lib/roles.ts`)

Hard-coded TypeScript functions. They take a `role` string and return `true`/`false`. Examples:

```ts
canManageUsers('ceo')     // true
canEditBudget('manager')  // false
isLeadership('co-owner')  // true
```

These are **fast** (no DB hit) and **always work for built-in roles**. They do NOT know about custom roles — a custom role will always return `false`.

Use them as fallbacks or for simple binary checks.

### 7.2 Granular permission keys (`lib/permissions.ts` + `role_permissions` table)

Every (role, permission_key) pair has an `enabled` boolean in the `role_permissions` table. The CEO can toggle any of them on the `/permissions` page in the UI.

There are ~50 keys — see `PERMISSION_KEYS` in `lib/permissions.ts`. Examples:

```
section.tasks          → can see Tasks nav item + page
task.create            → can create tasks
task.delete            → can delete tasks
pipeline.view_all      → can see contacts not assigned to them
expense.approve        → can approve / reject expenses
```

You check them like this:

```ts
import { hasPermission } from '@/lib/permissions';

if (await hasPermission(user.role, 'task.create')) {
  // they can do it
}
```

**Reading is cached for 5 minutes** in the Node process memory. So calling this 1000 times only hits the DB once (per process).

After you change permissions in the admin UI, the API calls `invalidatePermissionCache()` so the next request reads fresh data.

### 7.3 Per-user / per-resource checks (inline)

Sometimes the question isn't "can this role do X" but "can THIS user touch THIS row." Examples:

- You can edit your own task even if you don't have `task.edit_any`.
- You can delete your own note even if you're not the author.
- You can see a pipeline contact if you're assigned OR a collaborator.

These checks live inside the specific route handler:

```ts
const task = await supabaseAdmin.from('tasks').select('created_by, assigned_to').eq('id', id).single();
const isOwner = task.data?.created_by === user.id || task.data?.assigned_to === user.id;
if (!isOwner && !(await hasPermission(user.role, 'task.edit_any'))) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### 7.4 Adding a new permission — full walkthrough

Let's add `widget.delete`.

**Step 1 — Add it to the key list.** Open `lib/permissions.ts`:

```ts
export const PERMISSION_KEYS = [
  // ... existing keys ...
  'widget.delete',                       // ← add here
] as const;
```

**Step 2 — Add a label.** Same file, `PERMISSION_LABELS`:

```ts
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  // ... existing ...
  'widget.delete': 'Delete widgets',
};
```

**Step 3 — Put it in a group** so the admin UI shows it under the right section:

```ts
export const PERMISSION_GROUPS = [
  // ... existing ...
  {
    label: 'Widgets',
    keys: ['widget.create', 'widget.delete'],
  },
];
```

**Step 4 — Seed it in a migration.** Create `database/migration-008.sql` (next number after the last one):

```sql
-- migration-008.sql
-- Seed widget.delete for all built-in roles.
do $$
declare
  r text;
  default_enabled boolean;
begin
  for r in select unnest(array['ceo','owner','co-owner','manager','employee','accountant','viewer']) loop
    -- only enable for leadership
    default_enabled := r in ('ceo','owner','co-owner');
    insert into role_permissions(role, permission_key, enabled)
    values (r, 'widget.delete', default_enabled)
    on conflict (role, permission_key) do nothing;
  end loop;
end$$;
```

**Step 5 — Run the migration.** Open Supabase Dashboard → SQL Editor → paste the migration → Run.

**Step 6 — Use it in your DELETE route:**

```ts
if (!(await hasPermission(user.role, 'widget.delete'))) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Step 7 (optional) — Show/hide a UI element** based on it. The Sidebar already does this — see how it calls `can('section.widgets', fallback)`. For other places, you can fetch `/api/me/permissions` once and check the map.

That's it. The key is now toggleable in `/permissions` for any role, including custom ones.

---

## 8. Database — how to read and change it

### 8.1 The two SQL files you care about

| File | Purpose | When to edit |
|------|---------|--------------|
| `database/schema.sql` | The **initial install snapshot**. If someone clones the project and runs this in a fresh Supabase project, they get a working schema as of the day it was written. | **Almost never.** Don't add new columns here mid-flight — that's what migrations are for. |
| `database/migration-NNN.sql` | An **incremental change**. One file per logical change set, numbered in order. | Always — every DB change you make goes in a new migration file. |

### 8.2 Adding a column

Say you want to add a `priority` column to the `widgets` table.

1. Look at `ls database/` to find the highest migration number. The next one is `migration-008.sql`.
2. Create the file:

```sql
-- migration-008.sql
-- Adds a priority column to widgets.
alter table widgets
  add column if not exists priority text default 'normal'
  check (priority in ('low', 'normal', 'high'));
```

3. Open Supabase → SQL Editor → paste → Run.
4. Now use it in your code:

```ts
.select('id, name, priority')
.insert({ name, priority: 'high' })
```

### 8.3 Adding a new table

```sql
-- migration-009.sql
create table if not exists widgets (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text default 'gray',
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One index per column the app filters on
create index if not exists widgets_created_by_idx on widgets(created_by);

-- If you want auto-updating updated_at:
create trigger update_widgets_updated_at before update on widgets
  for each row execute function update_updated_at_column();
```

Always include `if not exists` so re-running the migration is safe.

### 8.4 Database conventions

| Topic | Rule |
|---|---|
| Primary keys | `uuid default uuid_generate_v4() primary key` |
| Timestamps | `timestamptz default now()` |
| Money | `numeric(12,2)` — never `float`, never `real` |
| Enums | `text` with a `check (column in (...))` constraint. To add a value, alter the constraint in a migration. |
| Foreign keys | `references some_table(id)`. Use `on delete cascade` when child rows should die with the parent (e.g. `task_updates` when a task is deleted). Use nothing for `created_by` (you don't want deleting a user to nuke their work). |
| Soft delete | `is_active = false` on `profiles`. Everything else hard-deletes. |
| Indexes | One index per column you `.eq()` filter on. Composite index when you filter on two columns together. |

### 8.5 How to actually run a query (in your code)

```ts
// SELECT
const { data, error } = await supabaseAdmin
  .from('widgets')
  .select('id, name, color')        // ← only the columns you need
  .eq('created_by', user.id)         // WHERE created_by = user.id
  .order('created_at', { ascending: false })
  .limit(50);

// INSERT (returns the new row when you add .select().single())
const { data, error } = await supabaseAdmin
  .from('widgets')
  .insert({ name: 'Foo', color: 'blue', created_by: user.id })
  .select()
  .single();

// UPDATE
const { error } = await supabaseAdmin
  .from('widgets')
  .update({ color: 'red' })
  .eq('id', widgetId);

// DELETE
const { error } = await supabaseAdmin
  .from('widgets')
  .delete()
  .eq('id', widgetId);
```

Always check `error`. If there is one, return 500.

### 8.6 Joining tables (the `select()` trick)

To join `widgets` to `profiles` on `created_by` and get the creator's name in the same query:

```ts
.select(`
  id, name,
  creator:profiles!widgets_created_by_fkey(id, full_name)
`)
```

The string before the colon (`creator`) becomes the property name on each row. The thing after the `!` is the FK constraint name. (Look at your migration to see what Supabase named it — typically `<table>_<column>_fkey`.)

---

## 9. Server components vs client components

This trips people up. Memorize this table.

| Need | Type | How |
|------|------|-----|
| Just render data from props or DB | **Server** | Default. Just `export default async function`. No directive. |
| `useState`, `useEffect`, event handlers, browser APIs | **Client** | First line of file: `"use client";` |
| Fetch data | **Server** | `await supabaseAdmin.from(...)`. If a Client needs data, call an API route via `fetch()`. |
| Show loading spinners | **Client** | Server components don't have "loading" — Next.js handles it via `loading.tsx` files. |
| Use `localStorage` / `sessionStorage` | **Client** | Wrap reads in `typeof window !== 'undefined'` checks to avoid SSR errors. |
| Import `lib/auth.ts`, `lib/permissions.ts`, `lib/email.ts` | **Server ONLY** | These files have `import 'server-only'` and will fail in a client component. |
| Import `lib/roles.ts` | Either | This file has no `server-only` — safe everywhere. |
| Use `getCurrentUser()` | **Server** | Reads cookies via `next/headers` — server only. |

### How to pass data from server → client

The whole point of server components is they fetch data and pass it down as JSX props:

```tsx
// page.tsx (server)
const widgets = await supabaseAdmin.from('widgets').select('*');
return <WidgetList widgets={widgets.data ?? []} />;
```

```tsx
// WidgetList.tsx (client)
"use client";
export default function WidgetList({ widgets }: { widgets: Widget[] }) {
  // can now useState etc.
}
```

### How a Client component fetches data

It can't query Supabase directly (no service key in the browser). It calls an API route:

```tsx
"use client";
import { useEffect, useState } from 'react';

export default function MyWidget() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/widgets').then(r => r.json()).then(setData);
  }, []);
  return <div>{data?.length}</div>;
}
```

---

## 10. The Supabase query language you actually need

Almost everything we do with the DB is one of these patterns. Bookmark this section.

### Selecting

```ts
.select('id, name, status')                     // pick columns
.select('*')                                    // everything (avoid in lists — heavy)
.eq('user_id', user.id)                         // =
.neq('status', 'completed')                     // !=
.in('status', ['open', 'pending'])              // status IN (...)
.gt('amount', 100)                              // >
.gte('created_at', '2026-01-01')                // >=
.lt('end_time', new Date().toISOString())       // <
.like('email', '%@gmail.com')                   // SQL LIKE
.ilike('name', '%john%')                        // case-insensitive LIKE
.or('status.eq.open,status.eq.pending')         // OR (annoying syntax — use sparingly)
.order('created_at', { ascending: false })      // ORDER BY
.limit(50)                                       // LIMIT
.range(0, 49)                                   // pagination (inclusive both ends)
.single()                                        // expect exactly 1 row; errors if 0 or 2+
.maybeSingle()                                  // 0 or 1 row; null if 0
```

### Inserting

```ts
// Single row
const { data, error } = await supabaseAdmin
  .from('widgets')
  .insert({ name: 'Foo', created_by: user.id })
  .select()       // optional — adds the new row to `data`
  .single();      // unwrap from array

// Multiple rows
await supabaseAdmin
  .from('event_attendees')
  .insert([
    { event_id: id, user_id: u1, status: 'invited' },
    { event_id: id, user_id: u2, status: 'invited' },
  ]);
```

### Updating

```ts
await supabaseAdmin
  .from('widgets')
  .update({ color: 'red', updated_at: new Date().toISOString() })
  .eq('id', widgetId);
```

### Deleting

```ts
await supabaseAdmin
  .from('widgets')
  .delete()
  .eq('id', widgetId);
```

### Upsert (insert OR update if a unique key conflicts)

```ts
await supabaseAdmin
  .from('budgets')
  .upsert(
    { month: '2026-05-01', category: 'rent', allocated_amount: 5000 },
    { onConflict: 'month,category' }   // matches the UNIQUE constraint
  );
```

### Counting

```ts
const { count } = await supabaseAdmin
  .from('tasks')
  .select('*', { count: 'exact', head: true })   // head:true = don't return rows
  .eq('assigned_to', user.id);
```

---

## 11. The 12 most common edits (recipes)

These are copy-paste-friendly. Each is a self-contained mini-walkthrough.

### Recipe 1 — Change a page title or button label

Open the relevant `app/<route>/page.tsx` (or component) and just edit the string. No build step.

```tsx
// before
<TopBar user={user} title="Tasks" />
// after
<TopBar user={user} title="My Work" />
```

### Recipe 2 — Add a new field to an existing form

Example: add a `notes` field to "Create Task".

1. **Add the column** (if it doesn't exist) — migration:
   ```sql
   alter table tasks add column if not exists notes text;
   ```
2. **Add the input** in `app/tasks/new/NewTaskForm.tsx` (a client component):
   ```tsx
   const [notes, setNotes] = useState('');
   // ...
   <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" />
   ```
3. **Send it** in the `fetch` body:
   ```ts
   body: JSON.stringify({ title, description, notes, /* ... */ })
   ```
4. **Accept it** in `app/api/tasks/route.ts`:
   ```ts
   const { title, description, notes, /* ... */ } = body;
   ```
5. **Store it** in the insert:
   ```ts
   .insert({ title, description, notes, /* ... */ })
   ```
6. **Show it** wherever you read tasks back (e.g. `app/tasks/[id]/page.tsx`) — add `notes` to the `.select('...')` and render it.

### Recipe 3 — Add a permission gate to an existing page

You decided `/calculators` should require a new `section.calculators_advanced` key.

1. Add the key + label + group in `lib/permissions.ts` (see [7.4](#74-adding-a-new-permission--full-walkthrough)).
2. Seed it in a migration:
   ```sql
   insert into role_permissions(role, permission_key, enabled)
   select unnest(array['ceo','owner','co-owner']), 'section.calculators_advanced', true
   on conflict do nothing;
   ```
3. At the top of `app/calculators/page.tsx`:
   ```ts
   if (!(await hasPermission(user.role, 'section.calculators_advanced'))) redirect('/');
   ```

### Recipe 4 — Add a new sidebar nav item

Open `components/Sidebar.tsx`, find `const groups: NavGroup[]`, drop your item into the right group:

```tsx
{
  label: 'Tools',
  items: [
    { href: '/calculators', label: 'Calculators', icon: Calculator, show: can('section.calculators', user.role !== 'viewer') },
    { href: '/reports',    label: 'Reports',     icon: BarChart3,   show: can('section.reports', isLeadership) },
  ],
},
```

The `show` field controls visibility. The pattern is `can('permission.key', fallbackBool)`:
- If permissions are loaded → use the granular system.
- If permissions haven't loaded yet → use the fallback so the user doesn't see nav flicker.

Also import your new icon at the top: `import { BarChart3 } from 'lucide-react';`

### Recipe 5 — Send an email when something happens

Open `lib/email.ts`. Add a new function patterned after `sendTaskAssignedEmail`:

```ts
export async function sendWidgetCreatedEmail(to: string, name: string, widget: any) {
  const html = emailWrapper(
    `<h2>Hi ${name.split(' ')[0]},</h2>
     <p>A new widget was created: <strong>${widget.name}</strong>.</p>`,
    'View Widget',
    `${APP_URL}/widgets/${widget.id}`,
  );
  return sendEmail(to, `Widget created: ${widget.name}`, html);
}
```

Then call it from your route:

```ts
import { sendWidgetCreatedEmail } from '@/lib/email';
// after the insert:
const { data: ceoProfile } = await supabaseAdmin
  .from('profiles')
  .select('email, full_name')
  .eq('role', 'ceo')
  .single();
if (ceoProfile) {
  await sendWidgetCreatedEmail(ceoProfile.email, ceoProfile.full_name, data);
}
```

**Note:** if `RESEND_API_KEY` isn't set in `.env.local`, emails silently log to the console. That's by design so dev doesn't fail without keys.

### Recipe 6 — Create an in-app notification

In-app notifications are rows in the `notifications` table. The bell icon in TopBar reads from it.

```ts
await supabaseAdmin.from('notifications').insert({
  user_id: assignee.id,                       // who sees it
  type: 'widget_assigned',                    // free-form string, used for filtering
  title: 'New widget assigned',
  message: `${user.full_name} assigned you "${data.name}"`,
  link: `/widgets/${data.id}`,                // where the bell click navigates
});
```

### Recipe 7 — Add an audit log entry

Always do this for sensitive actions (creates, deletes, role changes, money). The audit log is append-only.

```ts
await supabaseAdmin.from('audit_log').insert({
  user_id: user.id,
  action: 'widget_deleted',                   // verb_noun, your call
  resource_type: 'widget',
  resource_id: widgetId,
  details: { name: data.name },               // anything else as jsonb
});
```

### Recipe 8 — Add a new role

You don't need code for this — use the `/roles` admin UI.

1. Sign in as CEO.
2. Go to `/roles`.
3. Click "New Role".
4. Pick a key (e.g. `intern`), a friendly label, and a color.
5. Go to `/permissions` and toggle on whatever they need.

The key is stored on `profiles.role` for users who get this role. Built-in helpers like `isLeadership()` won't recognize it (since they're hard-coded), so anything gated by those will treat it as a regular user. The granular permission keys WILL work for it.

### Recipe 9 — Restrict an action to "owner or admin"

The pattern for "you can edit your own thing OR you have a global permission":

```ts
const { data: row } = await supabaseAdmin
  .from('widgets')
  .select('created_by')
  .eq('id', id)
  .single();

const isOwner = row?.created_by === user.id;
const isAdmin = await hasPermission(user.role, 'widget.edit_any');

if (!isOwner && !isAdmin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Recipe 10 — Paginate a long list

Server side, use `.range(start, end)` (both inclusive):

```ts
const page = parseInt(searchParams.page ?? '0', 10);
const PAGE_SIZE = 25;
const start = page * PAGE_SIZE;
const end   = start + PAGE_SIZE - 1;

await supabaseAdmin.from('widgets').select('*').range(start, end);
```

Browser side, just navigate to `/widgets?page=1`, etc.

### Recipe 11 — Schedule a recurring job

There's no built-in scheduler. Two options:

1. **Vercel Cron** — add to `vercel.json` (you'll need to create it):
   ```json
   {
     "crons": [
       { "path": "/api/cron/daily-overdue", "schedule": "0 8 * * *" }
     ]
   }
   ```
   Then create `app/api/cron/daily-overdue/route.ts`. **Important:** it'll be public when Vercel calls it. Add a shared secret check:
   ```ts
   if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```
   You'll also need to whitelist `/api/cron/` in `middleware.ts`.

2. **Supabase Edge Functions + pg_cron** — more involved; only if you outgrow Vercel Cron's quota.

### Recipe 12 — Roll back a change

If you broke something and need to revert:

```bash
git log --oneline -20            # find the commit BEFORE you broke it
git revert <bad-commit-hash>     # makes a new commit that undoes the bad one
git push
```

For a DB migration that turned out wrong, write a NEW migration that undoes it (e.g. `alter table widgets drop column if exists priority;`). Don't delete the broken migration file — that history is gone in prod already.

---

## 12. Adding a brand-new feature from scratch

Full walkthrough — adding a "Reports" module.

### Step 1 — Decide the data shape

What do you want to store? Let's say: every report has a title, a creator, a body (markdown), and a timestamp.

### Step 2 — Write the migration

`database/migration-010.sql`:

```sql
create table if not exists reports (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  body  text,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists reports_created_by_idx on reports(created_by);

create trigger update_reports_updated_at before update on reports
  for each row execute function update_updated_at_column();
```

Run it in Supabase.

### Step 3 — Add the permissions

`lib/permissions.ts`:

```ts
export const PERMISSION_KEYS = [
  // ...
  'section.reports',
  'report.create',
  'report.delete',
] as const;

PERMISSION_LABELS['section.reports'] = 'See Reports section';
PERMISSION_LABELS['report.create']   = 'Create reports';
PERMISSION_LABELS['report.delete']   = 'Delete reports';

PERMISSION_GROUPS.push({
  label: 'Reports',
  keys: ['section.reports', 'report.create', 'report.delete'],
});
```

Seed in `migration-011.sql`:

```sql
do $$
declare r text;
begin
  for r in select unnest(array['ceo','owner','co-owner','manager','employee','accountant','viewer']) loop
    insert into role_permissions(role, permission_key, enabled)
    values
      (r, 'section.reports', r in ('ceo','owner','co-owner','manager')),
      (r, 'report.create',   r in ('ceo','owner','co-owner','manager')),
      (r, 'report.delete',   r in ('ceo','owner','co-owner'))
    on conflict (role, permission_key) do nothing;
  end loop;
end$$;
```

Run it.

### Step 4 — Build the API routes

`app/api/reports/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'report.create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { title, body } = await request.json();
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('reports')
    .insert({ title, body, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

`app/api/reports/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { data: row } = await supabaseAdmin
    .from('reports').select('created_by').eq('id', id).single();

  const isOwner = row?.created_by === user.id;
  const canDelete = await hasPermission(user.role, 'report.delete');
  if (!isOwner && !canDelete) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('reports').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

### Step 5 — Build the page

`app/reports/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import ReportForm from './ReportForm';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!(await hasPermission(user.role, 'section.reports'))) redirect('/');

  const { data: reports } = await supabaseAdmin
    .from('reports')
    .select(`id, title, body, created_at,
             creator:profiles!reports_created_by_fkey(full_name)`)
    .order('created_at', { ascending: false })
    .limit(100);

  const canCreate = await hasPermission(user.role, 'report.create');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Reports" />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          {canCreate && <ReportForm />}
          <div className="mt-6 space-y-4">
            {(reports ?? []).map((r: any) => (
              <article key={r.id} className="card p-4">
                <h2 className="font-bold">{r.title}</h2>
                <p className="text-xs text-gray-500">
                  By {r.creator?.full_name} on {new Date(r.created_at).toLocaleDateString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{r.body}</p>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
```

`app/reports/ReportForm.tsx`:

```tsx
"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
    setSaving(false);
    if (!res.ok) { alert((await res.json()).error); return; }
    setTitle(''); setBody('');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <input className="input" placeholder="Report title" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="input" rows={6} placeholder="Body" value={body} onChange={e => setBody(e.target.value)} />
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? 'Saving…' : 'Publish report'}
      </button>
    </form>
  );
}
```

### Step 6 — Add it to the sidebar

In `components/Sidebar.tsx`:

```tsx
import { FileText } from 'lucide-react';
// ... inside `groups` ...
{
  label: 'Tools',
  items: [
    /* existing items */
    { href: '/reports', label: 'Reports', icon: FileText, show: can('section.reports', false) },
  ],
},
```

### Step 7 — Run it

```bash
npm run dev
```

Visit `http://localhost:3000/reports`. Done.

---

## 13. Common errors and what they mean

| Error you see | Meaning | Fix |
|---|---|---|
| **Page redirects to `/login` immediately after I sign in** | `JWT_SECRET` changed between sign and verify, OR cookie domain mismatch. | Make sure `.env.local` has a stable `JWT_SECRET`. Restart `npm run dev`. Clear the cookie in DevTools. |
| **"Cannot find module: server-only" in client component** | You imported `lib/auth.ts` or another `server-only` module into a `"use client"` file. | Move the import to a server file. Pass the result down as props. |
| **`getCurrentUser()` returns null in an API route** | The cookie is missing/expired, OR `is_active = false` on the profile. | Sign in again. If still broken, check the `profiles` table. |
| **403 Forbidden on a page my role should access** | The role doesn't have the right permission key, OR you used the wrong key. | Sign in as CEO → `/permissions` → toggle on the key for that role. Or fix the key name in your code. |
| **"Forbidden" on a Twilio webhook** | The path isn't whitelisted in `middleware.ts`. | Add the prefix to `TWILIO_WEBHOOK_PREFIXES`. |
| **Emails never arrive** | `RESEND_API_KEY` empty (logs to console silently) or domain unverified. | Check `.env.local`. Check Resend dashboard for SPF/DKIM/DMARC. |
| **"Cannot find module 'foo'" after I added a dep** | You forgot to run `npm install`. | Run it, then restart the dev server. |
| **`supabaseAdmin` is undefined / "service role key required"** | Env var missing. | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`. |
| **`uuid_generate_v4() does not exist`** | The `uuid-ossp` extension isn't enabled in your Supabase project. | Run `create extension if not exists "uuid-ossp";` in SQL editor. |
| **TypeScript red squigglies in the editor but build passes** | `next.config.js` has `typescript.ignoreBuildErrors: true`. The build is permissive on purpose. | Fix the squigglies anyway — they signal bugs that just don't block deploy. |
| **A page loads slowly** | Probably serial DB queries. See `docs/performance.md`. Use `Promise.all`. |
| **A page shows stale data after I edited something** | Browser is rendering a cached server response. After your `fetch()` use `router.refresh()` (client) or `revalidatePath()` (server action). |

---

## 14. Glossary

- **Server Component** — A React component that runs on the server, never in the browser. Can be async. Cannot have state/handlers. Default in Next.js App Router.
- **Client Component** — A React component with `"use client"` at the top. Hydrates in the browser. Can use `useState`, etc. Cannot be async by default.
- **Middleware** — Code in `middleware.ts` that runs on every request before any page/route handler. We use it for the cookie gate.
- **API route** — A file at `app/api/<path>/route.ts` that exports HTTP-verb functions (`GET`, `POST`, etc.). Returns JSON.
- **Service role key** — A Supabase API key that bypasses Row-Level Security. Server-only. Never goes to the browser.
- **Anon key** — A public Supabase key safe to expose in the browser. We barely use it.
- **JWT** — A signed string that carries claims like `{ id, email, role }`. Tamper-proof but readable; never put secrets inside one.
- **RLS** — Row-Level Security. PostgreSQL feature for per-row access rules. **We don't use it.** Auth happens in TypeScript.
- **Migration** — A SQL file in `database/migration-NNN.sql` that incrementally changes the schema. Run in order.
- **Hydration** — The process where client components attach to server-rendered HTML and start being interactive.
- **TwiML** — Twilio's XML "instruction language" for what to do on a call (dial, record, say, etc.). Some Twilio webhooks return TwiML; we generate it in `lib/twilio*.ts`.
- **Granular permission** — A row in `role_permissions` keyed by `(role, permission_key)`. Toggleable in the admin UI.
- **Built-in helper** — A hard-coded TS function in `lib/roles.ts` like `canManageUsers(role)`. Used for fallbacks.

---

## Where to go next

- [feature-walkthroughs.md](feature-walkthroughs.md) — Every feature explained: what files, what tables, what permissions.
- [api-reference.md](api-reference.md) — Every API endpoint at a glance.
- [data-model.md](data-model.md) — Every database table.
- [auth-and-permissions.md](auth-and-permissions.md) — Deep dive on the security model.
- [troubleshooting.md](troubleshooting.md) — Error → cause → fix.
