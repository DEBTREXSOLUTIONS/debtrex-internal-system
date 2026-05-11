import { redirect } from 'next/navigation';
import { getCurrentUser, canManageUsers } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TeamManager from './TeamManager';

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // Allow if section permission is on OR has manage permission OR is leadership
  const allowed = await hasPermission(user.role, 'section.team') || canManageUsers(user.role);
  if (!allowed) redirect('/');

  const { data: members } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, is_active, last_login_at, created_at, phone')
    .order('created_at', { ascending: false });

  // Dynamic roles: built-in + custom
  const { data: rolesData } = await supabaseAdmin
    .from('custom_roles')
    .select('role_key, label')
    .order('is_built_in', { ascending: false })
    .order('created_at', { ascending: true });

  const roles = (rolesData || []).map(r => ({ value: r.role_key, label: r.label }));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Team Management" />
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <TeamManager members={members || []} currentUser={user} roles={roles} />
        </div>
      </main>
    </div>
  );
}
