# Troubleshooting

A flat list of every error / symptom we've seen, what causes it, and how to fix it. Use Ctrl-F.

---

## Login & auth

### "Invalid credentials" but the password is right
- Email is case-sensitive in some flows. `/api/auth/login` lowercases the input — but if you've imported users with mixed-case emails, the lookup will fail. Check `select email from profiles where lower(email) = '…';` in Supabase.
- The account may be inactive — `is_active = false`. You'll see "Account deactivated" instead, but if the user was just imported with bad data, it might be missing.

### Login works but immediately redirects back to `/login`
- `JWT_SECRET` changed between when the cookie was signed and when it's verified. Restart `npm run dev` after changing `.env.local`. Then clear the cookie in DevTools and sign in again.
- The middleware uses `jose` (Edge) while the API uses `jsonwebtoken` (Node). Both verify against the same secret — if one library can't read it, you have an env-var issue. Look at the dev server console for `jwtVerify` errors.

### "Setup already completed"
- `/api/auth/setup` only works when the `profiles` table is empty. To make a new user after that, sign in as CEO → `/team` → Invite.

### Cookie disappears on every refresh
- In production, the cookie is `secure: true` and requires HTTPS. If you're testing on plain `http://`, the browser drops it. Use `https://` (Vercel sets this up automatically) or run in dev locally where `secure: false`.

---

## Permissions

### A user gets 403 on a page they should see
1. **Check the granular permission** — sign in as CEO → `/permissions` → toggle on the relevant key for their role.
2. **Check the code** — the page may be calling the wrong key, or using a hard-coded helper. Open the page file and look at the redirect line near the top.
3. **Check the cache** — `lib/permissions.ts` caches for 5 minutes. After toggling on `/permissions` the admin route calls `invalidatePermissionCache()`. If you changed something directly in SQL, the cache won't know — restart the server.

### Custom role acts like it has no permissions
- Built-in helpers in `lib/roles.ts` are hard-coded for the 7 built-in role names. Custom roles always return `false` for them.
- The granular system (the `role_permissions` table) does work for custom roles, but newly created custom roles start with **all permissions OFF**. Go to `/permissions`, switch to that role column, toggle stuff on.

### Sidebar shows the wrong items
- Sidebar uses `sessionStorage` to cache permissions for 5 minutes. After changing permissions, clear `sessionStorage` in DevTools or sign out and back in.
- Look at the `show` field in `components/Sidebar.tsx` for the misbehaving item — make sure the permission key matches what you seeded.

---

## Database / Supabase

### "uuid_generate_v4() does not exist"
Run `create extension if not exists "uuid-ossp";` in Supabase SQL Editor.

### "permission denied for table profiles"
You're querying with the anon client (`supabase`) instead of the admin client (`supabaseAdmin`). Server code should always use `supabaseAdmin`.

### `select('*')` returns weird/extra columns
You added a column in a migration but didn't restart the dev server. Try `Ctrl+C` and `npm run dev` again.

### "duplicate key value violates unique constraint"
Some table has a unique constraint (e.g. `(month, category)` on `budgets`). Use `.upsert()` instead of `.insert()` if you intend "insert OR update":
```ts
.upsert({...}, { onConflict: 'month,category' })
```

### "null value in column 'foo' violates not-null constraint"
The DB requires this column. Either:
- Pass a value when inserting.
- Add a `default` in the schema.
- Make the column nullable in a migration.

### `.single()` throws "JSON object requested, multiple (or no) rows returned"
- `.single()` requires exactly 1 row.
- Use `.maybeSingle()` for "0 or 1".
- For lists, drop both — Supabase returns an array by default.

### Slow queries on Supabase
- Run `EXPLAIN ANALYZE` on the query in the SQL editor.
- Add an index — see [recipes.md → R5](recipes.md#r5--add-an-index-for-a-slow-query).
- Trim the columns in your `.select(...)`. `select('*')` on a table with big text columns is expensive.

---

## Next.js / React

### "Cannot find module '@/lib/auth'"
- Restart the dev server.
- Make sure `tsconfig.json` has the `@/*` path alias (should already be there).

### "Module not found: Can't resolve 'next/headers'" (in a client component)
- You imported `lib/auth.ts` or another `server-only` module from a `"use client"` file.
- Fix: move that import to a server file (a `page.tsx`, a route handler) and pass the data down as props.

### "Text content does not match server-rendered HTML" (hydration error)
- A client component is rendering something different on the server vs client. Common causes:
  - Reading `localStorage` / `sessionStorage` during render (won't exist on server). Wrap reads in a `useEffect` or check `typeof window !== 'undefined'`.
  - Using `new Date()` directly — server time ≠ client time. Convert to a string consistently.
  - Conditional rendering based on `window` width — render the same thing on server and then update in `useEffect`.

### Server Component throws "params should be awaited"
In Next.js 15+, `params` and `searchParams` are async:
```ts
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

### "Event handlers cannot be passed to Client Component props"
You forgot `"use client"` at the top of a component that uses `onClick` (or any handler).

### Changes don't show up
- Restart the dev server. Next.js's HMR is good but not perfect.
- Delete `.next/` and restart for the nuclear option.
- Hard refresh in the browser (Ctrl+Shift+R / Cmd+Shift+R).

### Build error "Type error: ..."
`next.config.js` has `typescript.ignoreBuildErrors: true` so the build technically passes despite TS errors. But the errors are real. Look at the dev server output, find the file, fix it.

---

## Email (Resend)

### Emails don't arrive
- Check `RESEND_API_KEY` is set in `.env.local`. If empty, emails are silently logged to the dev console (look there).
- Check the Resend dashboard → Logs. If you see "Domain not verified," your DNS records aren't right yet.
- Check spam / junk folder, especially for new domains.
- Make sure `EMAIL_FROM` matches a verified domain. You can't send from `noreply@yourdomain.com` until that domain is verified in Resend.

### Got `403 Forbidden` from Resend
- The "from" address isn't on a verified domain.
- Use `onboarding@resend.dev` as a temporary `EMAIL_FROM` for testing.

---

## Google Drive

### "Drive not connected" persists after Connect
- Open DevTools → Network. Did `/api/google/callback` succeed? If it errored, look at the response.
- Common cause: the redirect URI in Google Cloud Console doesn't exactly match `GOOGLE_REDIRECT_URI` in `.env.local`. Both must be identical, scheme and trailing slash included.

### "Token expired" errors
- Google refresh tokens last ~6 months but can be revoked. The fix is to disconnect and reconnect: `/settings` → Disconnect Drive, then re-do the OAuth flow.

### File upload fails with 401
- The user's stored token is dead. Same fix as above.

---

## Twilio

### Outbound calls fail with "Twilio not configured"
- Check all 5 Twilio env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`.
- `/api/twilio/diagnostics` returns booleans — visit it as leadership to see which one is missing.

### Inbound calls don't ring the browser
- Is the user "online" in their status dropdown? Routing `available` only picks online agents.
- Is `phone_number_routing` configured for the number? Go to `/twilio-numbers` and set it.
- Check Twilio's debug logs in their console — look at the latest call and read the request/response trail.

### Twilio webhook returns 403
- The path isn't whitelisted. Add it to `TWILIO_WEBHOOK_PREFIXES` in `middleware.ts`.

### "Forbidden" on `/api/twilio/voice-token`
- The user doesn't have `call.make`. Toggle it on at `/permissions`.

### Browser microphone doesn't work
- Calls require HTTPS. On `http://localhost:3000` it works (browsers allow localhost). On a real deployment without HTTPS it won't. Vercel gives you HTTPS by default.

---

## Performance

### A page loads slowly
1. Open DevTools → Network → the page document request.
2. Look at TTFB (Time To First Byte). If it's > ~500ms, the bottleneck is server-side data fetching.
3. The page is probably running `await` queries in series. Wrap them in `Promise.all`. See `docs/performance.md`.
4. Bound large lists with `.limit(200)` (or pagination).
5. Trim `.select('*')` to only the columns you actually render.

### Bundle is too big / dev mode is slow
- Dev mode is significantly slower than prod. Run `npm run build && npm start` to compare.
- Don't import heavy libraries from server-shared modules (`lib/`) — keep them in client components that are only loaded on the relevant page.

---

## Build & deploy

### Vercel build fails
- Check Vercel build logs for the exact error.
- Most common cause: an env var is missing in Vercel's Environment Variables.
- Note: TS errors do NOT block the build (`ignoreBuildErrors: true`). They show as warnings.

### "Server selected an unsupported protocol"
- The redirect URI on Google OAuth doesn't include the production URL. Add the prod `https://...` redirect URI to your Google Cloud OAuth Client.

### After deploy, user gets "Not Found" on the dashboard
- Cookies aren't getting set in production. Check that `NEXT_PUBLIC_APP_URL` matches the deployed domain.
- Check that the cookie is actually being set — DevTools → Application → Cookies for your domain. The `debtrex_session` cookie should be there after login.

---

## Quick "I broke it" rollback

```bash
git log --oneline -20         # find the commit before you broke it
git revert <bad-commit>        # creates a new commit that undoes the bad one
git push
```

Vercel will auto-deploy the revert within a minute or two.

For a DB migration that turned out wrong: write a new migration that reverses the change. Don't delete the old migration file from git.

---

## Reset everything (nuclear option)

If you want to wipe your local environment and start fresh:

```bash
rm -rf node_modules .next
npm install
npm run dev
```

To reset the database: in Supabase Dashboard → Database → Settings → "Reset database" (warning: destroys all data).
