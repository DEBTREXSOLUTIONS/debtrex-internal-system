import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { canAssignAgentsToManagers } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import AssignmentsManager from './AssignmentsManager';

export default async function AssignmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAssignAgentsToManagers(user.role)) redirect('/');

  // All active users
  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('is_active', true)
    .order('full_name');

  // All current manager-agent assignments
  const { data: assignments } = await supabaseAdmin
    .from('manager_assignments')
    .select(`
      id,
      manager_id,
      agent_id,
      created_at,
      manager:profiles!manager_assignments_manager_id_fkey(id, full_name, email, role),
      agent:profiles!manager_assignments_agent_id_fkey(id, full_name, email, role)
    `);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Manager Assignments" />
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <AssignmentsManager
            users={users || []}
            assignments={assignments || []}
          />
        </div>
      </main>
    </div>
  );
}
