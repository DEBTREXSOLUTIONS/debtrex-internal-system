# UI & Styling Guide

How the website *looks* — colors, fonts, reusable CSS classes, component patterns, mobile rules.

If you want to change visual design (a button color, a font, the brand red), this is the doc.

---

## 1. The brand

| Token | Hex | Tailwind class |
|-------|-----|----------------|
| Brand Red | `#E02020` | `bg-brand-red`, `text-brand-red`, `border-brand-red` |
| Brand Red Dark (hover) | `#B81414` | `bg-brand-red-dark` |
| Brand Red Light | `#FF3B3B` | `bg-brand-red-light` |
| Brand Red Pale (backgrounds) | `#FFF0F0` | `bg-brand-red-pale` |
| Ink (primary text) | `#111111` | `text-brand-ink`, `bg-brand-ink` |
| Ink-2 (secondary text) | `#333333` | `text-brand-ink-2` |

The palette lives in `tailwind.config.js` under `theme.extend.colors.brand`. Add a new shade there if needed.

### Fonts

- **Default / body** — Barlow. Class: `font-sans` (default — you don't have to write it).
- **Display / condensed** — Barlow Condensed Black. Class: `font-condensed`. Use for big headings, KPI numbers, hero text.

Both are loaded via Google Fonts in `app/globals.css` at the top.

---

## 2. Reusable classes (defined in `globals.css`)

These are **NOT** Tailwind built-ins. They're our own component classes built with `@apply`. Use them everywhere for visual consistency.

### Buttons

```html
<button class="btn-primary">Save</button>       <!-- red, white text -->
<button class="btn-outline">Cancel</button>     <!-- ink border, transparent fill -->
<button class="btn-ghost">View all</button>     <!-- text-only, no border -->
```

All buttons have a **minimum 42px tap target** so they work on mobile.

### Card

```html
<div class="card p-6">
  <!-- content -->
</div>
```

White background, rounded, light shadow. Apply your own padding (`p-6`, etc.).

### Form inputs

```html
<label class="label">Email</label>
<input class="input" type="email" />
```

- `.label` — small, bold, uppercase, tracked-out gray text.
- `.input` — full-width, bordered, 16px font on mobile (prevents iOS zoom on focus).

### Badges (small pills)

```html
<span class="badge badge-red">Overdue</span>
<span class="badge badge-green">Completed</span>
<span class="badge badge-blue">In progress</span>
<span class="badge badge-yellow">Submitted</span>
<span class="badge badge-gray">Not started</span>
```

### Headings

```html
<h1 class="heading-condensed text-3xl">PIPELINE</h1>
```

Short for `font-condensed font-black uppercase tracking-tight`.

### Animations

```html
<div class="fade-in">Appears with a 300ms fade-up.</div>
```

### Scrollbars

- Custom red-on-hover scrollbar is global.
- `.no-scrollbar` hides scrollbars while keeping scroll behavior — useful for horizontal filter rows.

---

## 3. The page shell (every page uses this)

Every authenticated page has the same outer shape:

```tsx
<div className="flex min-h-screen bg-gray-50">
  <Sidebar user={user} />
  <main className="flex-1 min-w-0">
    <TopBar user={user} title="My Page Title" />
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* page content goes here */}
    </div>
  </main>
</div>
```

- `min-h-screen` ensures the sidebar fills the viewport.
- `flex-1 min-w-0` on the main column lets it grow without overflowing.
- `max-w-7xl mx-auto` keeps content from getting too wide on big monitors.
- `p-4 sm:p-6` is the standard padding.

**Change the max width?** Wider lists usually use `max-w-7xl`. Forms / detail pages use `max-w-3xl`. Login uses `max-w-md`.

---

## 4. Sidebar — navigation

Lives in `components/Sidebar.tsx`. Black background, white text, red accents.

Navigation is **grouped** (Home / Pipeline / Tools / Team / Financial / Admin). Each group has its own collapse state, persisted to `localStorage`.

Each `NavItem` has:
```ts
{ href, label, icon, show }
```

The `show` boolean comes from the `can('permission.key', fallbackBool)` helper:
- If permissions have loaded, it uses the granular map.
- If not, it uses the fallback (so the UI doesn't flicker).

**To add a new link, see [recipes.md → R27](recipes.md#r27--add-a-sidebar-link).**

---

## 5. TopBar — header

Lives in `components/TopBar.tsx`. White, sticky-ish.

- Page title (passed as prop).
- Status dropdown (Online / OTL / Meeting / Break / Offline).
- Bell icon (notifications) — currently linked, dropdown rendering may be in a subcomponent.
- Avatar with initials.

**Status values** are defined in the `STATUSES` array at the top of `TopBar.tsx`. To add one, also extend the CHECK constraint on `profiles.status` via a migration.

---

## 6. Icons

We use [lucide-react](https://lucide.dev) exclusively. Import only what you need:

```tsx
import { CheckSquare, Plus, AlertCircle } from 'lucide-react';
<CheckSquare size={16} />
```

`next.config.js` has `optimizePackageImports: ['lucide-react']` so unused icons are tree-shaken out.

Common sizes:
- 12 — inside small buttons (`btn-ghost`).
- 14 — `btn-primary`/`btn-outline`.
- 16 — sidebar nav, generic.
- 20 — TopBar.
- 24 — section headers.
- 32 — empty states.

---

## 7. Color conventions

| Purpose | Class |
|---------|-------|
| Primary action button | `bg-brand-red text-white` |
| Secondary action button | `border-brand-ink text-brand-ink` |
| Error / overdue | `text-brand-red` / `bg-brand-red-pale` |
| Success | `text-green-700` / `bg-green-50` |
| Warning | `text-yellow-700` / `bg-yellow-50` |
| Info | `text-blue-700` / `bg-blue-50` |
| Subtle background | `bg-gray-50` |
| Card border | `border-gray-200` |
| Body text | `text-gray-900` (default ink) |
| Muted text | `text-gray-500` / `text-gray-600` |
| Placeholder/disabled | `text-gray-400` |

---

## 8. Spacing scale (Tailwind defaults)

| Class | px |
|-------|-----|
| `p-1` | 4 |
| `p-2` | 8 |
| `p-3` | 12 |
| `p-4` | 16 |
| `p-5` | 20 |
| `p-6` | 24 |
| `p-8` | 32 |

Same for `m-`, `gap-`, `space-x-`/`space-y-`.

---

## 9. Responsive (mobile-first)

Tailwind classes without a prefix apply on all screen sizes. Prefixes mean "from this size up":

- `sm:` ≥ 640px
- `md:` ≥ 768px
- `lg:` ≥ 1024px
- `xl:` ≥ 1280px

Typical pattern in this codebase:

```html
<div class="p-4 sm:p-6 max-w-7xl mx-auto">      <!-- tighter padding on phones -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">   <!-- responsive columns -->
<div class="hidden lg:block">                    <!-- desktop only -->
<div class="lg:hidden">                          <!-- mobile only -->
```

The sidebar collapses to a hamburger menu under `lg:` (1024px).

---

## 10. Forms

Standard form pattern:

```tsx
<form onSubmit={submit} className="space-y-4">
  <div>
    <label className="label">Title</label>
    <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
  </div>
  <div>
    <label className="label">Description</label>
    <textarea className="input" rows={4} value={desc} onChange={e => setDesc(e.target.value)} />
  </div>
  <div className="flex justify-end gap-2">
    <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
    <button type="submit" className="btn-primary" disabled={saving}>
      {saving ? 'Saving…' : 'Save'}
    </button>
  </div>
</form>
```

- `space-y-4` gives consistent vertical spacing between fields.
- Always show a disabled state on the submit button while saving — disabled +
  swapping label is the cheapest UX win.

---

## 11. Modals

There's no shared `<Modal>` component — each modal is inlined. The standard pattern:

```tsx
{open && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg max-w-md w-full p-6 fade-in">
      <h2 className="heading-condensed text-xl mb-4">New widget</h2>
      {/* form */}
    </div>
  </div>
)}
```

- `fixed inset-0` covers the screen.
- `z-50` puts it above the sidebar.
- `bg-black/50` is the backdrop.
- `flex items-center justify-center` centers the panel.
- `max-w-md w-full` makes it responsive.

Add `onClick={() => setOpen(false)}` to the backdrop if you want click-outside-to-close.

---

## 12. Empty states

```tsx
<div className="text-center py-10">
  <CheckSquare size={32} className="mx-auto text-gray-300 mb-3" />
  <h3 className="font-semibold text-gray-700">No tasks yet</h3>
  <p className="text-sm text-gray-500 mt-1">Create one to get started.</p>
  <Link href="/tasks/new" className="btn-primary mt-4">+ Create Task</Link>
</div>
```

The dashboard's `EmptyState` component is a reusable version of this — copy it if you're building lots of empty-state UI.

---

## 13. Loading states

For full pages, Next.js looks for `loading.tsx` in the same folder as `page.tsx`. Drop in a skeleton:

```tsx
// app/tasks/loading.tsx
export default function Loading() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="w-64 bg-brand-ink" />        {/* sidebar placeholder */}
      <main className="flex-1 p-6">
        <div className="h-8 w-48 bg-gray-200 rounded mb-6 animate-pulse" />
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />)}
        </div>
      </main>
    </div>
  );
}
```

For inline (button) loading, just swap the label: `{saving ? 'Saving…' : 'Save'}`.

---

## 14. Adding a new color or component class

1. **A new color:** edit `tailwind.config.js`:
   ```js
   colors: {
     brand: {
       red: '#E02020',
       gold: '#D4A017',     // new
     },
   },
   ```
   Now `text-brand-gold`, `bg-brand-gold`, etc. work everywhere.

2. **A new reusable class:** edit `app/globals.css`:
   ```css
   .btn-success {
     @apply inline-flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-2.5 rounded-md hover:bg-green-700;
     min-height: 42px;
   }
   ```
   Use it like any other class: `<button className="btn-success">…</button>`.

---

## 15. Don't reach for these (anti-patterns)

- **Don't use inline `style={...}`** unless you genuinely need a dynamic value (computed color, computed width). For static styles use Tailwind classes.
- **Don't add a CSS module** (`.module.css`) — we're 100% on utility classes + globals.
- **Don't install another UI kit** (MUI, shadcn, Chakra) — we hand-build to keep the bundle small. The card / button / input classes cover 95% of needs.
- **Don't use `<a>` for in-app links** — use `<Link from 'next/link'>` so client-side nav works and prefetching kicks in.
