# DEBTREX Internal System — Developer Documentation

Welcome. This folder is the dev-facing complement to the top-level `README.md` (which is for operators / setup). Read these in order if you're new:

| # | Doc | What it covers |
|---|-----|----------------|
| 1 | [architecture.md](architecture.md) | High-level shape of the system — Next.js App Router, server vs. client, Supabase, external services |
| 2 | [data-model.md](data-model.md) | Every database table, what it stores, and how the tables relate |
| 3 | [auth-and-permissions.md](auth-and-permissions.md) | Login flow, session cookies, role system, the permission key matrix, where checks live |
| 4 | [api-reference.md](api-reference.md) | Every API route, what method, what it does, who can call it |
| 5 | [dev-workflow.md](dev-workflow.md) | Running locally, common dev tasks, how to add a new module or permission, gotchas |
| 6 | [performance.md](performance.md) | The perf model — what was slow, what was fixed, where to look next |

## Quick map

```
debtrex-system/
├── app/                    Next.js App Router — pages + API routes
│   ├── api/                Backend route handlers (route.ts files)
│   ├── (every other dir)/  A page route — page.tsx is the entry
│   └── layout.tsx          Root layout (just html/body shell)
├── components/             Shared client components (Sidebar, TopBar, dialers)
├── lib/                    Server-side utilities — auth, permissions, supabase client, integrations
├── database/               schema.sql + numbered migration-NNN.sql files
├── middleware.ts           Auth gate — runs on every request before page/API handlers
└── docs/                   You are here.
```

## Where to make changes

- **A new page** → `app/<route>/page.tsx`. Server component by default. See [dev-workflow.md](dev-workflow.md).
- **A new API endpoint** → `app/api/<route>/route.ts`. Export `GET`/`POST`/`PATCH`/`DELETE`.
- **A new database column or table** → add a new `database/migration-NNN.sql` file. Don't edit `schema.sql` for live changes; it's the initial-install reference.
- **A new permission** → add the key in `lib/permissions.ts` AND seed it in a new migration. See [auth-and-permissions.md](auth-and-permissions.md#adding-a-new-permission).
- **A new role** → use the `/roles` admin UI; it's data, not code.

## Tech stack at a glance

| Concern | Choice |
|--------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| Auth | JWT cookies (custom — not Supabase Auth) |
| Email | Resend |
| File storage | Google Drive (per-user OAuth) |
| Voice | Twilio (browser SDK + webhooks) |
| Calendar UI | FullCalendar |
| Icons | lucide-react |
