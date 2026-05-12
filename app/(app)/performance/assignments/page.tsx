import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { canAssignAgentsToManagers } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';
import AssignmentsManager from './AssignmentsManager';

export default async function AssignmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const allowed = await hasPermission(user.role, 'performance.assign_managers') || canAssignAgentsToManagers(user.role);
  if (!allowed) redirect('/');

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
            <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <AssignmentsManager
            users={users || []}
            assignments={assignments || []}
          />
        </div>
  );
}
