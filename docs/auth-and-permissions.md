# Auth & Permissions

This app does **not** use Supabase Auth. Auth is hand-rolled: bcrypt passwords, JWT cookies, application-level permission checks. RLS is off; the server is the only thing standing between a user and the database.

## The session cookie

| | |
|---|---|
| Cookie name | `debtrex_session` |
| Set by | `POST /api/auth/login` (success) |
| Cleared by | `POST /api/auth/logout` and `clearSessionCookieOnResponse()` |
| Value | JWT signed with `JWT_SECRET` (env var) |
| Claims | `id`, `email`, `role`, `full_name` |
| Lifetime | 8 hours (`expiresIn: '8h'`) |
| Flags | `httpOnly`, `sameSite=lax`, `secure` in production |

Two JWT libraries, on purpose:
- **`jose`** in `middleware.ts` (Edge runtime — no Node crypto allowed).
- **`jsonwebtoken`** in `lib/auth.ts` (Node — used by API routes and Server Components).

Both verify against the same `JWT_SECRET`, so they're interchangeable.

## Login flow

```
POST /api/auth/login  { email, password }
  ↓ look up profile by email
  ↓ bcrypt.compare
  ↓ jwt.sign({ id, email, role, full_name }, JWT_SECRET, 8h)
  ↓ Set-Cookie: debtrex_session=<jwt>; HttpOnly; SameSite=Lax
  ← 200 { user }
```

## First-CEO setup

`POST /api/auth/setup { email, password, full_name }` works **only when the profiles table is empty**. It creates the first CEO. After that the endpoint returns "setup already completed" and you create more users via `/team` (Team UI → `POST /api/users/invite`).

## Middleware (route protection)

`middleware.ts` runs on every request. It allows through:

- Static assets (`/_next/*`, `/favicon.ico`)
- The login form and login API (`/login`, `/api/auth/login`, `/api/auth/setup`)
- The OAuth callback (`/api/google/callback`)
- Twilio webhooks (a whitelist of `/api/twilio/twiml`, `/status`, `/recording`, `/amd`, `/voice-twiml`, `/inbound`, `/inbound-fallback`, `/voicemail`) — these are POSTed by Twilio's servers, not the browser

Everything else needs a valid `debtrex_session` cookie. If absent or invalid:
- Page request → 302 to `/login`
- API request → 401 JSON

**Important:** middleware only verifies the JWT signature. It does NOT check `is_active` or current role — those checks live in `getCurrentUser()` at the page/route level.

## `getCurrentUser()` — what every server entry does

```ts
const user = await getCurrentUser();
if (!user) redirect('/login');           // page
// or
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); // route
```

What it does:
1. Read the cookie.
2. Verify the JWT.
3. Fetch the `profiles` row by id, selecting `id, email, full_name, role, google_drive_folder_id, is_active`.
4. Return null if `is_active = false`.

It's wrapped in React's `cache()` so multiple calls inside one request share the result. The DB hit happens once per request.

## Roles

Built-in roles (defined in `lib/roles.ts`):

| Role | Code constant |
|------|---------------|
| CEO | `ROLES.CEO` |
| Owner | `ROLES.OWNER` |
| Co-Owner | `ROLES.CO_OWNER` |
| Manager | `ROLES.MANAGER` |
| Employee | `ROLES.EMPLOYEE` |
| Accountant | `ROLES.ACCOUNTANT` |
| Viewer | `ROLES.VIEWER` |

Hard-coded helpers in `lib/roles.ts` answer questions like:

- `canManageUsers(role)`
- `canEditBudget(role)`
- `canApproveExpenses(role)`
- `canViewAllTasks(role)`
- `canCreateEvents(role)`
- `canDeleteUsers(role)` — CEO only
- `isLeadership(role)` — CEO / Owner / Co-Owner

These are pure functions — fine to import from both server and client.

Custom roles (created via `/roles`) live in `custom_roles`. Their `role_key` goes into `profiles.role` and starts with **all permissions OFF**. The built-in role helpers won't recognize them — only `hasPermission()` (the granular system) will.

## The granular permission system

There are about 50 permission keys, organized like `section.tasks`, `task.create`, `expense.approve`, `pipeline.view_all`, etc. The full list lives in `lib/permissions.ts` and the seed list in `database/migration-003.sql`.

Each (role, key) pair has an `enabled` bool in `role_permissions`. CEO can toggle any of them on the `/permissions` admin page.

### Checking permissions on the server

```ts
import { hasPermission } from '@/lib/permissions';

if (!(await hasPermission(user.role, 'task.delete'))) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Checking many permissions at once

```ts
import { getPermissions } from '@/lib/permissions';
const perms = await getPermissions(user.role);   // { 'task.delete': true, ... }
```

### Caching

`hasPermission()` lazy-loads the full `role_permissions` table into an in-process `Map` and caches it for **5 minutes**. Cache invalidates automatically by TTL. When you change permissions via the admin API, call `invalidatePermissionCache()` to flush immediately.

> The cache is per Node process. On Vercel, every cold-started function pays one DB query to fill the cache; warm requests don't.

### Client-side permission checks

Don't trust them — they're for UX only. The Sidebar pre-fetches `/api/me/permissions` once per session, caches the result in `sessionStorage` for 5 minutes, and uses it to decide which nav items to show. The actual security comes from the server-side `hasPermission()` checks in the page/API handler.

## Permission fallback pattern

Some pages combine both systems:

```ts
const allowed = await hasPermission(user.role, 'section.budget')
             || canEditBudget(user.role);   // built-in fallback
```

This means: the granular permission wins if it's set; otherwise the hard-coded built-in helper is used as a fallback. Use this when a new permission key was added but might not be seeded for older roles.

## Adding a new permission

1. **Add the key** to `PERMISSION_KEYS` in `lib/permissions.ts`.
2. **Add a label** in `PERMISSION_LABELS` so the admin UI shows a friendly name.
3. **Put it in a group** in `PERMISSION_GROUPS` so it appears under the right section.
4. **Seed it** in a new `database/migration-NNN.sql` — copy the `seed_permission` pattern from migration-003 (or `seed_perm_if_missing` from migration-006).
5. **Use it** in the relevant route handler: `await hasPermission(user.role, 'your.new.key')`.
6. After deploying, run the migration in Supabase SQL editor.

## Adding a new role

Use the `/roles` admin UI. No code change needed — custom roles work the same as built-ins for the granular permission system. They just won't satisfy the built-in `lib/roles.ts` helpers like `isLeadership()`, so anything that uses those helpers will treat custom roles as "not leadership."
