# DEBTREX Internal System — Developer Documentation

This folder is the dev-facing complement to the top-level `README.md` (which covers operator setup).

> **New to the codebase? Start with [EDITING-GUIDE.md](EDITING-GUIDE.md).** It's the master document — read that one and you can edit 95% of the codebase confidently.

---

## All the docs

### Read these first
| # | Doc | What you'll learn |
|---|-----|-------------------|
| 1 | **[EDITING-GUIDE.md](EDITING-GUIDE.md)** | The master guide. Mental model, file map, page/API anatomy, the 12 most common edits as walkthroughs, full "build a new feature from scratch" recipe, common errors. **Start here.** |
| 2 | [feature-walkthroughs.md](feature-walkthroughs.md) | Every feature explained: files it uses, tables it touches, permissions it needs, common edits. |
| 3 | [recipes.md](recipes.md) | 30 copy-paste-friendly templates for common tasks (add a column, gate a route, send an email, etc.). |
| 4 | [file-index.md](file-index.md) | Every file in the project mapped to its purpose. |
| 5 | [HOW-I-BUILT-task-requests.md](HOW-I-BUILT-task-requests.md) | Blow-by-blow record of building a real feature. Use as a reference template for any approval workflow. |

### Reference (deeper dives)
| # | Doc | What it covers |
|---|-----|----------------|
| 5 | [architecture.md](architecture.md) | High-level shape of the system — Next.js App Router, server vs. client, Supabase, external services |
| 6 | [data-model.md](data-model.md) | Every database table, what it stores, and how the tables relate |
| 7 | [auth-and-permissions.md](auth-and-permissions.md) | Login flow, session cookies, role system, the permission key matrix |
| 8 | [api-reference.md](api-reference.md) | Every API route, what method, what it does, who can call it |
| 9 | [ui-and-styling.md](ui-and-styling.md) | Tailwind setup, brand colors, button/card/badge classes, the page shell pattern |
| 10 | [dev-workflow.md](dev-workflow.md) | Running locally, env vars, common dev tasks, gotchas |
| 11 | [performance.md](performance.md) | The perf model — what was slow, what was fixed, where to look next |
| 12 | [troubleshooting.md](troubleshooting.md) | Every error we've seen → cause → fix |

---

## Quick "I want to do X" router

Use this to jump straight to the right doc.

| I want to… | Go here |
|------------|---------|
| Understand the whole system | [EDITING-GUIDE.md § 1–4](EDITING-GUIDE.md#1-the-mental-model-in-60-seconds) |
| Add a new page | [EDITING-GUIDE § 5](EDITING-GUIDE.md#5-how-a-page-is-built-anatomy) + [recipes.md → R14](recipes.md#r14--add-a-new-page) |
| Add a new API endpoint | [EDITING-GUIDE § 6](EDITING-GUIDE.md#6-how-an-api-route-is-built-anatomy) + [recipes.md → R7–R10](recipes.md#r7--add-a-get-endpoint) |
| Add a database column | [EDITING-GUIDE § 8](EDITING-GUIDE.md#8-database--how-to-read-and-change-it) + [recipes.md → R1](recipes.md#r1--add-a-column-to-an-existing-table) |
| Add a new role | `/roles` admin UI — no code needed |
| Add a new permission key | [EDITING-GUIDE § 7.4](EDITING-GUIDE.md#74-adding-a-new-permission--full-walkthrough) |
| Add a sidebar link | [recipes.md → R27](recipes.md#r27--add-a-sidebar-link) |
| Send a templated email | [recipes.md → R24](recipes.md#r24--send-a-templated-email) |
| Build a brand-new feature from scratch | [EDITING-GUIDE § 12](EDITING-GUIDE.md#12-adding-a-brand-new-feature-from-scratch) |
| Find which file does X | [file-index.md](file-index.md) |
| Find which permission gates X | [feature-walkthroughs.md](feature-walkthroughs.md) (look up the feature) |
| Fix an error message I'm seeing | [troubleshooting.md](troubleshooting.md) |
| Change a color or font | [ui-and-styling.md](ui-and-styling.md) |

---

## The codebase at a glance

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

## The 4 places you'll edit most often

- **A new page** → `app/<route>/page.tsx`. Server component by default. See [EDITING-GUIDE § 5](EDITING-GUIDE.md#5-how-a-page-is-built-anatomy).
- **A new API endpoint** → `app/api/<route>/route.ts`. Export `GET`/`POST`/`PATCH`/`DELETE`. See [EDITING-GUIDE § 6](EDITING-GUIDE.md#6-how-an-api-route-is-built-anatomy).
- **A new database column or table** → add a new `database/migration-NNN.sql` file. **Don't edit `schema.sql`** for live changes; it's the initial-install reference.
- **A new permission key** → add to `lib/permissions.ts` AND seed it in a new migration. See [EDITING-GUIDE § 7.4](EDITING-GUIDE.md#74-adding-a-new-permission--full-walkthrough).

## Tech stack at a glance

| Concern | Choice |
|---------|--------|
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

---

## Conventions, cheat-sheet style

| Thing | Convention |
|-------|-----------|
| Files | `kebab-case` for routes, `PascalCase` for components, `camelCase` for utilities |
| Routes (URLs) | `/snake_case` for paths, `[id]` for dynamic segments |
| DB tables | `snake_case`, plural (`tasks`, `pipeline_contacts`) |
| DB columns | `snake_case` |
| Money | `numeric(12,2)` in SQL, plain `number` in TS — never `float` |
| Timestamps | `timestamptz` with `default now()` |
| Primary keys | `uuid` |
| Authorization | Always app-level (`hasPermission`). **RLS is OFF** — never assume the DB will block bad calls. |
| Server-only files | `import 'server-only'` at the top |
| Client components | `"use client"` as the first line |

If you only remember one rule: **every API route must call `getCurrentUser()` first and check permissions before doing any DB work.**
