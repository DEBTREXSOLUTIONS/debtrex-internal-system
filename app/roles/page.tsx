import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isLeadership } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import RolesManager from './RolesManager';

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isLeadership(user.role)) redirect('/');

  // Fetch all roles (built-in + custom)
  const { data: roles } = await supabaseAdmin
    .from('custom_roles')
    .select('*')
    .order('is_built_in', { ascending: false })
    .order('created_at', { ascending: true });

  // Count users per role for display
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('is_active', true);

  const userCounts: Record<string, number> = {};
  (profiles || []).forEach(p => {
    userCounts[p.role] = (userCounts[p.role] || 0) + 1;
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Custom Roles" />
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <RolesManager roles={roles || []} userCounts={userCounts} />
        </div>
      </main>
    </div>
  );
}
