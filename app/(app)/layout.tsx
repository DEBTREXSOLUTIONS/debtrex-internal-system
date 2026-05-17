import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getPermissions } from '@/lib/permissions';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

// Shared shell for every authenticated page.
//
// Anything under app/(app)/ inherits this layout, which means:
// 1. The Sidebar and TopBar stay mounted across navigations (no flicker).
// 2. Any sibling `loading.tsx` is rendered INSTANTLY when navigating,
//    while the next page is server-rendering its data. That's how we get
//    the "open immediately, show skeleton, then load content" feel.
//
// `app/login` is intentionally OUTSIDE this group so the login page has
// no shell.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const permissions = await getPermissions(user.role);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} permissions={permissions} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} />
        {children}
      </main>
    </div>
  );
}
