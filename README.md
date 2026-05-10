# DEBTREX SOLUTIONS — Internal Operations System

A complete internal operations platform for DEBTREX SOLUTIONS, including:

- **Authentication & Roles** — secure logins, 7 role tiers managed by leadership
- **Dashboard** — at-a-glance view of tasks, events, and recent activity
- **Tasks** — create, assign, track work with deadlines, time tracking, and activity log
- **Calendar** — team events plus auto-pulled task deadlines, FullCalendar UI
- **Files** — Google Drive integration with per-user personal folders
- **Budget Tracker** — income, expenses, monthly budgets, expense approvals
- **Email Alerts** — automatic notifications for tasks, deadlines, expenses, etc.

Built with Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgreSQL), and the Google Drive API.

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Fill in environment variables (see "Environment Setup" below)

# 4. Run the database schema in Supabase
#    (paste database/schema.sql into the Supabase SQL Editor)

# 5. Start the dev server
npm run dev

# 6. Visit http://localhost:3000

# 7. Create your CEO account by sending a one-time POST request:
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"ceo@debtrex.com","password":"ChangeMe123!","full_name":"Your Name"}'
```

After setup, sign in at `/login` with the credentials you used.

---

## Environment Setup

### 1. Supabase (Database)

1. Sign up at [supabase.com](https://supabase.com) (free tier is fine)
2. Create a new project — choose a strong database password
3. Wait ~2 minutes for the project to provision
4. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)
5. Go to the **SQL Editor**, paste the entire contents of `database/schema.sql`, and click **Run**

### 2. JWT Secret

Generate a random string for signing session tokens:

```bash
openssl rand -base64 32
```

Paste the output into `JWT_SECRET`.

### 3. Google Drive API

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: **DEBTREX Internal**
3. **APIs & Services → Library** → enable **Google Drive API**
4. **APIs & Services → OAuth consent screen** → External (or Internal if Workspace) → add app name, support email, scopes
5. **APIs & Services → Credentials** → **Create Credentials → OAuth Client ID** → Web Application
   - Authorized redirect URI: `http://localhost:3000/api/google/callback` (also add your production URL)
6. Copy the **Client ID** and **Client Secret** into `.env.local`
7. In Google Drive, create a master folder (e.g., "DEBTREX Internal Files"). Open the folder and copy the ID from the URL: `drive.google.com/drive/folders/{THIS_PART}` → paste into `GOOGLE_DRIVE_ROOT_FOLDER_ID`

### 4. Resend (Email)

1. Sign up at [resend.com](https://resend.com) (free tier: 100 emails/day)
2. **Add Domain** — add your domain and configure the DNS records they show you (SPF, DKIM, DMARC)
3. Once verified, **Create API Key** → copy to `RESEND_API_KEY`
4. Set `EMAIL_FROM` to e.g. `DEBTREX <noreply@yourdomain.com>` (must use the verified domain)

> Don't have a domain ready? You can use Resend's `onboarding@resend.dev` for testing, or set `RESEND_API_KEY` to anything and emails will print to the console (system won't crash without email).

---

## Roles & Permissions

| Role | What They Can Do |
|------|------------------|
| **CEO / Owner** | Everything: manage all users and roles, all data, billing, system settings |
| **Co-Owner** | Same as CEO except cannot remove CEO/Owner accounts |
| **Manager** | Assign tasks, view team calendar, view team budget |
| **Employee** | Create/update own tasks, view own calendar and files |
| **Accountant** | Full budget access, approve expenses, view-only on tasks |
| **Viewer** | Read-only access where permitted |

Roles are enforced both in the UI and in every API route — frontend permission checks alone are not relied upon.

---

## Project Structure

```
debtrex-system/
├── app/                       # Next.js 14 App Router
│   ├── api/                   # Backend API routes
│   │   ├── auth/              # Login, logout, setup
│   │   ├── tasks/             # Task CRUD + updates
│   │   ├── events/            # Calendar events
│   │   ├── expenses/          # Budget — expenses
│   │   ├── income/            # Budget — income
│   │   ├── users/             # Team management
│   │   ├── google/            # OAuth flow
│   │   └── files/             # File upload, delete
│   ├── login/                 # Login page
│   ├── tasks/                 # Tasks list, detail, new
│   ├── calendar/              # Calendar view
│   ├── files/                 # Google Drive UI
│   ├── budget/                # Budget dashboard
│   ├── team/                  # Team management (CEO/Owner only)
│   ├── settings/              # User settings
│   ├── notifications/         # In-app notifications
│   └── page.tsx               # Main dashboard
├── components/                # Shared UI components (Sidebar, TopBar)
├── lib/                       # Core utilities
│   ├── auth.ts                # Auth + permissions
│   ├── supabase.ts            # DB client
│   ├── email.ts               # Resend wrapper + templates
│   └── google-drive.ts        # Drive OAuth + API
├── database/
│   └── schema.sql             # Run this in Supabase
├── middleware.ts              # Route protection
└── .env.example               # Environment template
```

---

## Deployment to Vercel

1. Push your code to GitHub (private repo)
2. Sign up at [vercel.com](https://vercel.com)
3. **Add New Project** → import your repo
4. **Environment Variables** → paste all values from `.env.local`
5. Update these values for production:
   - `NEXT_PUBLIC_APP_URL` → `https://your-domain.com`
   - `GOOGLE_REDIRECT_URI` → `https://your-domain.com/api/google/callback`
6. In Google Cloud Console, **add the production redirect URI** to your OAuth Client
7. Click **Deploy**

After it deploys, run the `/api/auth/setup` POST request against your production URL to create the first CEO.

---

## Estimated Monthly Costs

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Vercel | Pro | $20 |
| Supabase | Pro | $25 |
| Resend | Pro 50K | $20 |
| Google Workspace | Business Standard | $12/user |
| **Total (10 users)** | | **~$185/month** |

The free tier of all services is enough to test the system end-to-end before committing to paid plans.

---

## Daily / Weekly Cron Jobs (Recommended)

Set these up in Vercel Cron or as Supabase Edge Functions to keep the system fresh:

- **Daily 8:00 AM** — Mark overdue tasks, send overdue emails
- **Daily 7:00 AM** — Send "deadline in 24 hours" reminders
- **Monday 8:00 AM** — Weekly digest email per user
- **1st of month** — Monthly financial summary to leadership

---

## Security Checklist (Before Launch)

- [ ] All API routes verify authentication AND role permissions
- [ ] Strong `JWT_SECRET` generated and kept secret
- [ ] HTTPS enforced (Vercel does this automatically)
- [ ] Database backups enabled in Supabase (Pro plan does this automatically)
- [ ] Two-factor authentication enabled for CEO/Owner accounts
- [ ] Production redirect URIs added to Google OAuth Client
- [ ] Domain verified with Resend (SPF, DKIM, DMARC)
- [ ] All environment variables stored as secrets, not committed to git
- [ ] `.env.local` listed in `.gitignore`

---

## Troubleshooting

**"Google Drive not connected"** — User needs to click *Connect Google Drive* on the Files page. This runs the OAuth flow.

**"Cannot find module"** — Run `npm install` again.

**Login works but redirects to login again** — Check `JWT_SECRET` is the same value used to sign the token. Restart the server after changing.

**Emails not arriving** — Check Resend dashboard for delivery logs. If DNS records aren't verified, emails go to spam.

**"Setup already completed"** — The `/api/auth/setup` endpoint only works when there are 0 users. To create more users, sign in as CEO and use the Team page.

---

## Next Steps After Launch

1. **Onboard your team** — Invite users from the `/team` page; they receive emails with temp passwords
2. **Set up master Drive folders** — Create `01-Users`, `02-Clients`, `03-Templates`, etc., as outlined in the build guide
3. **Set initial monthly budgets** — Use the budget page to allocate amounts per category
4. **Train your team** — Record a 5-minute Loom walkthrough for each module
5. **Iterate** — Watch usage, fix friction, add features as needed

---

## License

Proprietary — DEBTREX SOLUTIONS internal use only.
