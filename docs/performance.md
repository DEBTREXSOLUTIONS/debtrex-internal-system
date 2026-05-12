# Performance Notes

This doc tracks what's known about app performance — what was slow, what was fixed, and what's worth doing next when you have time.

## Mental model

The app's hot path on a page view is:

1. **Middleware** — JWT verify (cheap, in-memory).
2. **`getCurrentUser()`** — 1 DB query (profile lookup), `react.cache()`d per request.
3. **Page-level queries** — 1 to N Supabase calls. **These are usually the slowest step.**
4. **Render + stream HTML** — fast.
5. **Client hydrate** — Sidebar/TopBar/InboundCallListener mount, each doing their own `fetch()` calls.

Whenever the app feels slow, the question is almost always: *how many round-trips, and are they in parallel?*

## What was fixed (May 2026)

| Fix | Files | Why it mattered |
|-----|-------|----------------|
| Parallelized 3 serial DB queries on Dashboard | `app/page.tsx` | Cut page render time roughly in 3 |
| Parallelized + date-windowed Calendar fetch | `app/calendar/page.tsx` | Was fetching every event/deadline ever; now ±6 months. Same parallelization win. |
| Parallelized Task Detail fetch | `app/tasks/[id]/page.tsx` | task, updates, and notes now load together |
| Parallelized Performance metrics fetch | `lib/performance.ts` | Users / tasks / updates were serial — now in `Promise.all` |
| Parallelized Budget fetch + bounded income | `app/budget/page.tsx` | Income had no `limit`; bounded to 200 |
| Bounded Tasks list to 200 rows | `app/tasks/page.tsx` | Was unbounded — would grow forever |
| Trimmed `select('*')` to needed columns | dashboard, tasks list, calendar | Smaller payloads, less serialization |
| Removed wasted `GET /api/me/status` on every page nav | `components/TopBar.tsx` | Was fetching the entire team list, then immediately overwriting with PATCH |
| Mark-online runs once per session, not per nav | `components/TopBar.tsx` | Used `sessionStorage` flag |
| Re-enabled Next.js `prefetch` on sidebar links | `components/Sidebar.tsx` | Nav now warms up the next page on hover |
| Removed dead deps: `recharts`, `react-email`, `@react-email/components`, `date-fns` | `package.json`, `next.config.js` | Faster install, smaller node_modules |

**Run `npm install` after pulling these changes** to drop the dead deps from your local node_modules.

## What's still a thing

These are documented for the next perf pass — not urgent unless data grows.

### `getCurrentUser()` does a DB query per request

`react.cache()` dedupes within a request, but every page load still incurs one `profiles` row lookup. Options if this becomes a bottleneck:

- Trust the JWT for shell rendering (Sidebar/TopBar) and only DB-verify for sensitive actions.
- Add a short LRU cache (e.g. 30 sec per user_id) — profile changes are rare, and `is_active` toggles can wait that long.

### The permission cache is per-process

`lib/permissions.ts` caches the `role_permissions` table in process memory for 5 minutes. On Vercel, every cold-started serverless function pays one DB fill. Per request, it's free after the first. Acceptable today.

### N+1 risk on pipeline list

The pipeline list joins both `assigned_to_profile` and `created_by_profile`. As you grow past a few hundred contacts, that join will dominate. Consider denormalizing the displayed name onto the contact row, or paginating server-side.

### FullCalendar + lucide-react bundle weight

FullCalendar is the heaviest client dep but already isolated to `/calendar` chunk (it's only imported in `CalendarView.tsx`). `next.config.js` opts it into `optimizePackageImports`. Lucide icons are tree-shaken via `optimizePackageImports`.

### Inbound call listener fetches a token on every page

`InboundCallListener` is mounted from `Sidebar`, so every page nav fires `GET /api/twilio/voice-token`. Could be cached client-side (token has a TTL — re-issue only when expired). Not a huge cost but worth knowing.

### Indexes that might matter at scale

These aren't bottlenecks at current data sizes, but consider when tables grow past tens of thousands of rows:

| Table | Index | Why |
|-------|-------|-----|
| `tasks` | composite `(assigned_to, status)` | Most "my open tasks" queries filter on both |
| `tasks` | partial `(deadline) WHERE status NOT IN ('completed','cancelled')` | Calendar/dashboard deadline lookups |
| `events` | composite `(start_time, end_time)` | Range queries from FullCalendar |
| `task_updates` | composite `(user_id, created_at desc)` | Performance "last activity" |
| `expenses` | composite `(status, expense_date desc)` | Budget dashboard listing |
| `call_logs` | already good — composite indexes on `(contact_id, called_at)` and `(user_id, called_at)` |

Always profile first. Adding an index has write-side cost.

## How to measure if a page is slow

1. In Chrome DevTools → Network, hover the page document request. Note **TTFB** — that's the server-render time.
2. If TTFB is bad, the bottleneck is DB queries. Run `EXPLAIN ANALYZE` on the relevant query in Supabase SQL editor.
3. If TTFB is OK but the page still feels slow, it's bundle / hydration. Check the size of the page's JS chunk in `npm run build` output.

If you see a perf regression, the most common cause in this codebase is "someone added a `select('*')` join or a sequential `await` they didn't need to."

## Dev-server only slowness

Next.js dev mode (`npm run dev`) is significantly slower than production. Reasons:

- Routes are compiled on first request, not ahead of time.
- HMR adds overhead.
- React Strict Mode (enabled in `next.config.js`) double-invokes effects in dev.

If a page feels slow in dev but fine after `npm run build && npm start`, it's a dev-mode artifact, not a real bug.
