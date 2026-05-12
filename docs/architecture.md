# Architecture

A single Next.js 14 (App Router) app that handles both the UI and the API. Everything that talks to the database, sends email, or calls Twilio runs on the server. The browser only sees rendered HTML + small client islands for interactivity.

## Request lifecycle (page navigation)

```
Browser → middleware.ts → app/<route>/page.tsx (server) → Supabase → HTML → client islands hydrate
```

1. **Browser hits a URL.**
2. **`middleware.ts`** runs first. It checks for the `debtrex_session` cookie, verifies the JWT with `jose`, and either lets the request through or redirects to `/login`. Public paths (login API, Twilio webhooks, `/api/google/callback`) are allowed without a cookie.
3. **The page is a React Server Component.** It calls `getCurrentUser()` (validates JWT, fetches the profile row), then runs its data queries against Supabase using the **service-role client** (`supabaseAdmin`).
4. **Permission check.** Pages with restricted access call `hasPermission(role, key)`. The permissions table is loaded once and cached in process memory for 5 minutes.
5. **HTML streams back.** Client components (`"use client"`) hydrate for interactivity — modals, dropdowns, optimistic state.

## Request lifecycle (API call)

```
Browser fetch → middleware.ts → app/api/<route>/route.ts → getCurrentUser → permission check → supabaseAdmin → JSON
```

API routes follow the exact same auth flow as pages. Every route handler should:

1. Call `getCurrentUser()` and return 401 if null.
2. Call `hasPermission(user.role, '<key>')` for the action. Return 403 if false.
3. Do the work. Return JSON.

Look at `app/api/tasks/route.ts` for the canonical shape.

## Two Supabase clients (important)

```ts
// lib/supabase.ts
export const supabase       // anon key — for browser-safe reads. Almost never used in this app.
export const supabaseAdmin  // service-role key — bypasses RLS. Used everywhere on the server.
```

This app does **not** use Postgres RLS. Authorization is enforced entirely in TypeScript (via `hasPermission()` and the helpers in `lib/roles.ts`). That means:

- Every API route MUST do its own permission check. There's no DB safety net.
- The browser never gets the service-role key — it's a server-only secret.
- If you ever add code paths where the browser talks to Supabase directly, you need to switch on RLS or you'll have a hole.

## Auth model — JWT cookies, not Supabase Auth

- Users live in our own `profiles` table with bcrypt-hashed passwords.
- Login: `POST /api/auth/login` checks the password, signs a JWT (`jsonwebtoken`), sets the `debtrex_session` httpOnly cookie. 8-hour expiry.
- The Edge middleware verifies the JWT using `jose` (Edge runtime can't run `jsonwebtoken`'s Node crypto). The API routes verify with `jsonwebtoken` because they run on Node.
- The JWT payload carries `id`, `email`, `role`, `full_name` so we don't need a DB hit just to know who you are. We *do* re-fetch the profile in `getCurrentUser()` to honor role changes and `is_active` flips mid-session.

## External integrations

| Service | What for | Where |
|---|---|---|
| **Supabase** (Postgres) | All data storage | `lib/supabase.ts` |
| **Resend** | Outbound email — task assigns, deadline alerts, invites | `lib/email.ts` |
| **Google Drive** | Per-user file storage (OAuth, refresh tokens stored on profile) | `lib/google-drive.ts`, `app/api/google/*` |
| **Twilio Voice** | Browser-based outbound + inbound calls, recording, AMD, voicemail | `lib/twilio.ts`, `lib/twilio-voice.ts`, `app/api/twilio/*` |

## The "permissions" layer

There are three things called "permissions" in this codebase. Don't confuse them.

1. **Role helpers** in `lib/roles.ts` — hard-coded checks like `canViewAllTasks(role)`. Used for fallback / built-in roles where the answer is constant.
2. **The `role_permissions` table** — every (role, permission_key) pair with an `enabled` bool. CEO can toggle these in the `/permissions` UI. Checked via `hasPermission()`.
3. **`/api/me/permissions`** — endpoint that returns the calling user's flat permission map, cached client-side in `sessionStorage` for 5 minutes so the Sidebar doesn't refetch on every nav.

When you add a feature: hardcode the fallback in `lib/roles.ts` for built-in roles, **and** add the granular key in `lib/permissions.ts` and seed it in a migration. The granular toggle wins if it exists.

## Folder responsibilities

| Folder | Rules |
|---|---|
| `app/` | Pages and API routes only. Server components by default — only mark `"use client"` when you need state/effects/handlers. |
| `components/` | Reusable client components. None of these should query Supabase directly — they receive data as props or call API routes. |
| `lib/` | Server-only utilities. Most files import `'server-only'` at the top so they fail loudly if imported from a client component. The exception is `lib/roles.ts`, which is pure functions safe to import from both sides. |
| `database/` | `schema.sql` is the initial install. Anything after is `migration-NNN.sql`, applied in order via the Supabase SQL editor. |

## What doesn't exist (don't look for it)

- **No Redux / Zustand / global store.** Each page is a server render; client state is local.
- **No tRPC or GraphQL.** Plain `fetch` to `/api/...` routes.
- **No ORM.** Direct Supabase client queries.
- **No tests.** (Yet.)
- **No RLS.** Authorization is in app code.
