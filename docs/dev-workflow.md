# Developer Workflow

## Running locally

```bash
npm install
cp .env.example .env.local       # fill in the values
npm run dev                       # → http://localhost:3000
```

Required env vars (full list in `.env.example`):

| Var | Where it comes from |
|-----|---------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same |
| `SUPABASE_SERVICE_ROLE_KEY` | same — keep secret |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Google Cloud Console |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend dashboard |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID` | Twilio console |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev |

You can skip Twilio / Resend / Google in dev — those features will degrade gracefully (Twilio routes 503, emails print to console if `RESEND_API_KEY` is unset).

## First-run database setup

Paste `database/schema.sql` into Supabase SQL Editor → Run. Then run every `migration-NNN.sql` in order. After that:

```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"ceo@example.com","password":"ChangeMe123!","full_name":"Your Name"}'
```

This endpoint is the only way to create the first CEO. After that it's locked.

## Common tasks

### Add a page

1. Create `app/<route>/page.tsx`. It's a Server Component by default.
2. Boilerplate:

```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!(await hasPermission(user.role, 'section.mything'))) redirect('/');

  // Parallel-fetch everything you need
  const [aRes, bRes] = await Promise.all([
    supabaseAdmin.from('a').select('...'),
    supabaseAdmin.from('b').select('...'),
  ]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="My Page" />
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {/* content */}
        </div>
      </main>
    </div>
  );
}
```

3. Add to the Sidebar's nav groups in `components/Sidebar.tsx` if it should appear there.

### Add an API route

See [api-reference.md § Conventions](api-reference.md#conventions-for-new-routes). The three rules: auth first, validate input, use `supabaseAdmin`.

### Add a database column

```bash
# 1. Find the next migration number
ls database/
# 2. Create database/migration-008.sql
# 3. alter table xxx add column if not exists ...;
# 4. Open Supabase SQL editor → run
# 5. Update TS types where the column is read
```

Don't edit `schema.sql` — that's the install-from-scratch snapshot.

### Add a permission

Walk through is in [auth-and-permissions.md § Adding a new permission](auth-and-permissions.md#adding-a-new-permission).

### Switch between client and server

| You need... | Component type |
|---|---|
| Just rendering data from props | Server (default — no directive) |
| `useState`, `useEffect`, event handlers, hooks | Client (`"use client"` at top of file) |
| Fetch data | Prefer server. If a client component needs data, call an API route. |
| Pass data from server → client | Just pass it as props in JSX. |

Client components **cannot** import anything from a file that starts with `import 'server-only'` (`lib/auth.ts`, `lib/permissions.ts`, `lib/email.ts`, `lib/google-drive.ts`, `lib/twilio*.ts`, `lib/performance.ts`). If you need role helpers in the browser, import from `lib/roles.ts` (which has no `server-only` import).

## Gotchas you'll hit

- **`Cannot find module` after changing files** — restart `npm run dev`. The compiler caches aggressively.
- **Login works then immediately redirects back to /login** — `JWT_SECRET` changed between sign and verify. Sign in again after changing it. In dev, also clear the cookie.
- **"Forbidden" on a page that should be allowed** — check `role_permissions` for that role + key. Then check `lib/roles.ts` for the built-in helper that the page uses. Then check the route's permission check.
- **`Cannot read property 'id' of null` server-side** — you forgot `getCurrentUser()` and the redirect.
- **Twilio webhook 403** — middleware needs to whitelist the path. Check `TWILIO_WEBHOOK_PREFIXES` in `middleware.ts`.
- **Emails not arriving** — when `RESEND_API_KEY` is empty or invalid, emails are silently logged to the console. Check the dev server output.
- **Google Drive not connected for a user** — the user has to visit `/files` and click "Connect Google Drive" themselves. Their token is stored on their profile row.
- **`server-only` imported from client component** — error like `Module not found: Can't resolve 'next/headers'`. Move the import to a server file and pass data as props.

## Build & deploy

```bash
npm run build     # compiles + page-by-page bundle stats in the output
npm start         # serve the built app
```

`next.config.js` currently sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` — meaning TS errors won't block a build. That's pragmatic but means TS errors silently land in prod. When time allows, flip these off and fix the lingering errors.

Deploy: push to `main`; Vercel auto-deploys. Set all `.env.local` values as Vercel Environment Variables. Update `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` to the production domain, and add the prod redirect URI to your Google OAuth Client.

## Reading the codebase

- Start at `middleware.ts` to see what happens to every request.
- Then `lib/auth.ts` and `lib/permissions.ts` — the two files you'll come back to most.
- Then `app/page.tsx` (the dashboard) — it's the simplest example of the standard page pattern.
- Then `app/api/tasks/route.ts` and `app/api/tasks/[id]/route.ts` — the canonical API route shape.
- The pipeline (`app/pipeline/*` + `app/api/pipeline/*`) is the most complex module — read it last when you're comfortable.
