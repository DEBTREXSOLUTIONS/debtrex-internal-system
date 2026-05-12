# Recipes — Copy-Paste Templates

A library of solved problems. Find the recipe that matches your task, copy it, and adapt.

Each recipe is **self-contained** — read it without context and you can do it.

---

## Index

### Database
- [R1 — Add a column to an existing table](#r1--add-a-column-to-an-existing-table)
- [R2 — Add a new table](#r2--add-a-new-table)
- [R3 — Add a foreign key](#r3--add-a-foreign-key)
- [R4 — Add an enum value to a CHECK constraint](#r4--add-an-enum-value-to-a-check-constraint)
- [R5 — Add an index for a slow query](#r5--add-an-index-for-a-slow-query)
- [R6 — Backfill data](#r6--backfill-data)

### API routes
- [R7 — Add a GET endpoint](#r7--add-a-get-endpoint)
- [R8 — Add a POST endpoint](#r8--add-a-post-endpoint)
- [R9 — Add a PATCH endpoint](#r9--add-a-patch-endpoint)
- [R10 — Add a DELETE endpoint](#r10--add-a-delete-endpoint)
- [R11 — Validate request body with Zod](#r11--validate-request-body-with-zod)
- [R12 — Return CSV instead of JSON](#r12--return-csv-instead-of-json)
- [R13 — Upload a file (multipart)](#r13--upload-a-file-multipart)

### Pages
- [R14 — Add a new page](#r14--add-a-new-page)
- [R15 — Add a page with a dynamic ID](#r15--add-a-page-with-a-dynamic-id)
- [R16 — Pass query-string filters to a page](#r16--pass-query-string-filters-to-a-page)
- [R17 — Add a modal form](#r17--add-a-modal-form)
- [R18 — Refresh server data after a client action](#r18--refresh-server-data-after-a-client-action)

### Permissions
- [R19 — Gate a page by permission](#r19--gate-a-page-by-permission)
- [R20 — Gate an API by permission](#r20--gate-an-api-by-permission)
- [R21 — "Owner or admin" check](#r21--owner-or-admin-check)
- [R22 — Hide a UI element by permission](#r22--hide-a-ui-element-by-permission)
- [R23 — Add a new permission key](#r23--add-a-new-permission-key)

### Email & notifications
- [R24 — Send a templated email](#r24--send-a-templated-email)
- [R25 — Create an in-app notification](#r25--create-an-in-app-notification)
- [R26 — Respect user notification preferences](#r26--respect-user-notification-preferences)

### Misc
- [R27 — Add a sidebar link](#r27--add-a-sidebar-link)
- [R28 — Write an audit log entry](#r28--write-an-audit-log-entry)
- [R29 — Cache a permission check on the client](#r29--cache-a-permission-check-on-the-client)
- [R30 — Add a Twilio webhook](#r30--add-a-twilio-webhook)

---

## R1 — Add a column to an existing table

```sql
-- database/migration-NNN.sql   (NNN = next number)
alter table tasks add column if not exists priority_note text;
```

Run in Supabase SQL editor. Update the `.select()` and `.insert()` calls in your routes to include the new column.

---

## R2 — Add a new table

```sql
-- database/migration-NNN.sql
create table if not exists projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  status text default 'active' check (status in ('active', 'archived')),
  owner_id uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists projects_owner_id_idx on projects(owner_id);
create index if not exists projects_status_idx   on projects(status);

create trigger update_projects_updated_at before update on projects
  for each row execute function update_updated_at_column();
```

---

## R3 — Add a foreign key

```sql
-- Adding it via a new column:
alter table tasks add column if not exists project_id uuid references projects(id);
create index if not exists tasks_project_id_idx on tasks(project_id);
```

Use `on delete cascade` if child rows should die with the parent. Omit it for "created_by"-style references — you don't want deleting a user to nuke all their work.

---

## R4 — Add an enum value to a CHECK constraint

Constraints can't be modified in place — drop and recreate.

```sql
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add  constraint     tasks_status_check
  check (status in ('not_started','in_progress','submitted','completed','overdue','cancelled','on_hold'));
```

---

## R5 — Add an index for a slow query

Find the columns the query filters on (`WHERE` / `.eq()`) and the column it orders by.

```sql
-- Single column
create index if not exists tasks_assigned_to_idx on tasks(assigned_to);

-- Composite (when you filter on both columns together)
create index if not exists tasks_assigned_status_idx on tasks(assigned_to, status);

-- Partial (only useful subset of rows)
create index if not exists tasks_open_deadline_idx
  on tasks(deadline) where status not in ('completed','cancelled');
```

Always profile before adding indexes — they cost write performance.

---

## R6 — Backfill data

When you add a column with a NOT NULL constraint, you need a default OR a backfill.

```sql
-- migration-NNN.sql
alter table tasks add column if not exists category text;

update tasks set category = 'general' where category is null;

alter table tasks alter column category set not null;
```

---

## R7 — Add a GET endpoint

```ts
// app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id, name, status')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
```

---

## R8 — Add a POST endpoint

```ts
// app/api/projects/route.ts
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await hasPermission(user.role, 'project.create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({ name: body.name, owner_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

---

## R9 — Add a PATCH endpoint

```ts
// app/api/projects/[id]/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Only allow specific fields to be updated — never spread `...body`.
  const updates: any = { updated_at: new Date().toISOString() };
  if (typeof body.name   === 'string') updates.name   = body.name;
  if (typeof body.status === 'string') updates.status = body.status;

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

---

## R10 — Add a DELETE endpoint

```ts
// app/api/projects/[id]/route.ts
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Owner-or-admin check
  const { data: row } = await supabaseAdmin
    .from('projects').select('owner_id').eq('id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = row.owner_id === user.id;
  const isAdmin = await hasPermission(user.role, 'project.delete');
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

---

## R11 — Validate request body with Zod

```ts
import { z } from 'zod';

const Body = z.object({
  name: z.string().min(1).max(120),
  status: z.enum(['active', 'archived']).optional(),
  priority: z.number().int().min(1).max(5).optional(),
});

const parsed = Body.safeParse(await request.json());
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
}
const body = parsed.data;     // ← strictly typed now
```

---

## R12 — Return CSV instead of JSON

```ts
const { data: rows } = await supabaseAdmin
  .from('pipeline_contacts').select('first_name, last_name, phone, status');

const header = ['First','Last','Phone','Status'];
const csv = [
  header.join(','),
  ...(rows ?? []).map(r =>
    [r.first_name, r.last_name, r.phone, r.status]
      .map(v => `"${(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  ),
].join('\n');

return new Response(csv, {
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="contacts.csv"',
  },
});
```

---

## R13 — Upload a file (multipart)

```ts
// app/api/files/upload/route.ts (server)
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  // ... pass `bytes`, `file.name`, `file.type` to your storage helper
  return NextResponse.json({ ok: true });
}
```

```tsx
// client side
const fd = new FormData();
fd.append('file', selectedFile);
await fetch('/api/files/upload', { method: 'POST', body: fd });
// note: do NOT set Content-Type — the browser sets it with the boundary
```

---

## R14 — Add a new page

```tsx
// app/projects/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: projects } = await supabaseAdmin
    .from('projects').select('id, name').limit(100);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Projects" />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          {(projects ?? []).map(p => <div key={p.id}>{p.name}</div>)}
        </div>
      </main>
    </div>
  );
}
```

---

## R15 — Add a page with a dynamic ID

```tsx
// app/projects/[id]/page.tsx
import { notFound, redirect } from 'next/navigation';

export default async function ProjectPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const { data: project } = await supabaseAdmin
    .from('projects').select('*').eq('id', id).maybeSingle();
  if (!project) notFound();

  return /* JSX */;
}
```

---

## R16 — Pass query-string filters to a page

```tsx
// app/projects/page.tsx
export default async function ProjectsPage(
  { searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }
) {
  const params = await searchParams;
  const status = params.status || 'active';
  const page   = parseInt(params.page || '0', 10);

  let q = supabaseAdmin.from('projects').select('*').eq('status', status);
  q = q.range(page * 25, page * 25 + 24);
  const { data } = await q;
  // ...
}
```

---

## R17 — Add a modal form

The pattern is: a client component that holds an `open` boolean.

```tsx
"use client";
import { useState } from 'react';

export default function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (r.ok) { setOpen(false); window.location.reload(); }
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>New Project</button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded p-6 max-w-md w-full">
            <form onSubmit={submit}>
              <input value={name} onChange={e => setName(e.target.value)} className="input" />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## R18 — Refresh server data after a client action

```tsx
"use client";
import { useRouter } from 'next/navigation';

const router = useRouter();
// ... after a successful fetch ...
router.refresh();   // re-runs the server component on the current URL
```

For a full reload (rare): `window.location.reload()`.

---

## R19 — Gate a page by permission

```tsx
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { redirect } from 'next/navigation';

const user = await getCurrentUser();
if (!user) redirect('/login');

if (!(await hasPermission(user.role, 'section.projects'))) redirect('/');
```

---

## R20 — Gate an API by permission

```ts
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

if (!(await hasPermission(user.role, 'project.create'))) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## R21 — "Owner or admin" check

```ts
const { data: row } = await supabaseAdmin
  .from('projects').select('owner_id').eq('id', id).maybeSingle();
if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

const isOwner = row.owner_id === user.id;
const isAdmin = await hasPermission(user.role, 'project.edit_any');
if (!isOwner && !isAdmin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## R22 — Hide a UI element by permission

In a server component, just `await hasPermission(user.role, key)`:

```tsx
const canDelete = await hasPermission(user.role, 'project.delete');
return <DeleteButton show={canDelete} />;
```

In a client component, fetch `/api/me/permissions` once and check the map:

```tsx
"use client";
const [perms, setPerms] = useState<Record<string,boolean>>({});
useEffect(() => {
  fetch('/api/me/permissions').then(r => r.json()).then(d => setPerms(d.permissions || {}));
}, []);
// ... {perms['project.delete'] && <button>Delete</button>}
```

But almost always, prefer doing this in the server component and passing the result as a prop.

---

## R23 — Add a new permission key

Full walkthrough in [EDITING-GUIDE § 7.4](EDITING-GUIDE.md#74-adding-a-new-permission--full-walkthrough). Quick version:

1. Add to `PERMISSION_KEYS` in `lib/permissions.ts`.
2. Add to `PERMISSION_LABELS` and `PERMISSION_GROUPS` in same file.
3. Seed in a migration:
   ```sql
   insert into role_permissions(role, permission_key, enabled)
   select unnest(array['ceo','owner','co-owner']), 'project.create', true
   on conflict do nothing;
   ```
4. Use `hasPermission(user.role, 'project.create')` in your code.

---

## R24 — Send a templated email

In `lib/email.ts`, add:

```ts
export async function sendProjectCreatedEmail(to: string, name: string, project: any) {
  const html = emailWrapper(
    `<h2>Hi ${name.split(' ')[0]},</h2>
     <p>A new project was created: <strong>${project.name}</strong>.</p>`,
    'View Project',
    `${APP_URL}/projects/${project.id}`,
  );
  return sendEmail(to, `New project: ${project.name}`, html);
}
```

Then call it from your route:

```ts
await sendProjectCreatedEmail(targetUser.email, targetUser.full_name, data);
```

---

## R25 — Create an in-app notification

```ts
await supabaseAdmin.from('notifications').insert({
  user_id: targetUserId,
  type: 'project_created',
  title: 'New project created',
  message: `${user.full_name} created "${project.name}"`,
  link: `/projects/${project.id}`,
});
```

---

## R26 — Respect user notification preferences

`profiles.notification_preferences` is a `jsonb` blob. Read it before sending:

```ts
const { data: target } = await supabaseAdmin
  .from('profiles')
  .select('email, full_name, notification_preferences')
  .eq('id', targetId)
  .single();

if (target && target.notification_preferences?.task_assigned !== false) {
  // default to ON — only skip when explicitly false
  await sendTaskAssignedEmail(target.email, target.full_name, task);
}
```

To add a new preference key — just write it. The `jsonb` column doesn't need a migration for new keys.

---

## R27 — Add a sidebar link

In `components/Sidebar.tsx`, find the group you want and add an item:

```tsx
import { FolderKanban } from 'lucide-react';
// inside `groups`:
{
  label: 'Tools',
  items: [
    /* existing */
    {
      href: '/projects',
      label: 'Projects',
      icon: FolderKanban,
      show: can('section.projects', false),
    },
  ],
},
```

The `show` field controls visibility. `can('key', fallback)` checks the granular permission map; the fallback is what to show before perms load (use `true` for things everyone gets, `false` for restricted things).

---

## R28 — Write an audit log entry

```ts
await supabaseAdmin.from('audit_log').insert({
  user_id: user.id,
  action: 'project_deleted',
  resource_type: 'project',
  resource_id: projectId,
  details: { name: project.name },
});
```

Do this for: create, delete, role changes, money movement, permission changes. Skip it for reads.

---

## R29 — Cache a permission check on the client

The Sidebar already does this — it stores `/api/me/permissions` in `sessionStorage` for 5 minutes. To use the same cache elsewhere:

```tsx
"use client";
import { useEffect, useState } from 'react';

function useMyPerms() {
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const cached = sessionStorage.getItem('perms_my');
    if (cached) {
      const { permissions, savedAt } = JSON.parse(cached);
      if (Date.now() - savedAt < 300_000) { setPerms(permissions); return; }
    }
    fetch('/api/me/permissions').then(r => r.json()).then(d => {
      setPerms(d.permissions || {});
      sessionStorage.setItem('perms_my', JSON.stringify({
        permissions: d.permissions || {}, savedAt: Date.now(),
      }));
    });
  }, []);
  return perms;
}
```

---

## R30 — Add a Twilio webhook

Twilio webhooks are POSTed by Twilio's servers, so they bypass the cookie check.

1. Create the route, e.g. `app/api/twilio/recording-status/route.ts`:
   ```ts
   import { NextResponse } from 'next/server';
   export async function POST(request: Request) {
     const form = await request.formData();
     const callSid = form.get('CallSid');
     // ... do stuff
     return new Response('', { status: 200 });
   }
   ```

2. Whitelist the path in `middleware.ts`:
   ```ts
   const TWILIO_WEBHOOK_PREFIXES = [
     // existing
     '/api/twilio/recording-status',
   ];
   ```

3. Configure the URL in the Twilio console for whatever event you're handling.

4. **In production**, validate `X-Twilio-Signature`:
   ```ts
   import twilio from 'twilio';
   const url   = `${process.env.NEXT_PUBLIC_APP_URL}${request.nextUrl.pathname}`;
   const sig   = request.headers.get('x-twilio-signature') || '';
   const params = Object.fromEntries(form.entries());
   const ok = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN!, sig, url, params);
   if (!ok) return new Response('Forbidden', { status: 403 });
   ```
