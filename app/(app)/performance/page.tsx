import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { canViewTeamPerformance, canViewAllPerformance } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';
import { calculatePerformanceMetrics, getAgentsForManager } from '@/lib/performance';
import PerformanceView from './PerformanceView';

export default async function PerformancePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const allowed = await hasPermission(user.role, 'section.performance') || canViewTeamPerformance(user.role);
  if (!allowed) redirect('/');

  // Show "all" data if either permission grants it OR built-in leadership
  const isLeadership = await hasPermission(user.role, 'performance.view_all') || canViewAllPerformance(user.role);

  // Determine which users to show
  let userIds: string[] = [];

  if (isLeadership) {
    // CEO/Owner/Co-Owner see EVERYONE (except themselves to declutter)
    const { data: allUsers } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('is_active', true);
    userIds = (allUsers || []).map(u => u.id).filter(id => id !== user.id);
  } else {
    // Managers only see their assigned agents
    userIds = await getAgentsForManager(user.id);
  }

  const metrics = await calculatePerformanceMetrics(userIds);

  return (
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <PerformanceView
            metrics={metrics}
            isLeadership={isLeadership}
            currentUserName={user.full_name}
          />
        </div>
  );
}
