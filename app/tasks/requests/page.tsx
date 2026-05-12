import { redirect } from 'next/navigation';
import { getCurrentUser, isLeadership } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TaskRequestsView from './TaskRequestsView';

export default async function TaskRequestsPage(
  { searchParams }: { searchParams: Promise<{ status?: string; mine?: string }> }
) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const canRequest = await hasPermission(user.role, 'task.request');
  const canApprove = await hasPermission(user.role, 'task.approve_requests');

  if (!canRequest && !canApprove) redirect('/tasks');

  const params = await searchParams;
  const status = params.status || 'pending';
  const forceMine = params.mine === '1' || !canApprove;

  // Build the query — server-side mirror of the API logic so the page renders fast.
  let q = supabaseAdmin
    .from('task_requests')
    .select(`
      id, title, description, priority, deadline, estimated_days,
      requested_by, assigned_to, target_approver,
      status, resolved_by, resolved_at, denial_reason, created_task_id, created_at,
      requester:profiles!task_requests_requested_by_fkey(id, full_name, role),
      assignee:profiles!task_requests_assigned_to_fkey(id, full_name, role),
      approver:profiles!task_requests_target_approver_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') q = q.eq('status', status);

  if (forceMine) {
    q = q.eq('requested_by', user.id);
  } else if (!isLeadership(user.role)) {
    // manager scope
    const { data: assigns } = await supabaseAdmin
      .from('manager_assignments')
      .select('agent_id')
      .eq('manager_id', user.id);
    const visibleRequesters = Array.from(new Set([
      user.id,
      ...((assigns ?? []).map((a: any) => a.agent_id)),
    ]));
    const inList = visibleRequesters.map(id => `"${id}"`).join(',');
    q = q.or(`requested_by.in.(${inList}),target_approver.eq.${user.id}`);
  }

  // Approvers list for the "target a specific admin" dropdown in the new-request modal.
  // Anyone with task.approve_requests is eligible.
  const { data: allActive } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role')
    .eq('is_active', true)
    .order('full_name');

  const { data: rows } = await q;

  // Compute approver list: leadership + the requester's manager(s).
  // We pre-compute "all eligible approvers" by checking permissions for each
  // distinct role. (Roles, not user-ids — easier.)
  const distinctRoles = Array.from(new Set((allActive ?? []).map((u: any) => u.role)));
  const roleApprovalMap: Record<string, boolean> = {};
  for (const r of distinctRoles) {
    roleApprovalMap[r] = await hasPermission(r, 'task.approve_requests');
  }
  const approvers = (allActive ?? []).filter((u: any) => roleApprovalMap[u.role]);

  // Pending count (for the badge) — uses the same filter as the list so it
  // matches what this user actually sees.
  let pendingCount = 0;
  if (canApprove) {
    let pq = supabaseAdmin
      .from('task_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!isLeadership(user.role)) {
      const { data: assigns } = await supabaseAdmin
        .from('manager_assignments')
        .select('agent_id')
        .eq('manager_id', user.id);
      const visible = Array.from(new Set([user.id, ...((assigns ?? []).map((a: any) => a.agent_id))]));
      const inList = visible.map(id => `"${id}"`).join(',');
      pq = pq.or(`requested_by.in.(${inList}),target_approver.eq.${user.id}`);
    }
    const { count } = await pq;
    pendingCount = count ?? 0;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Task Requests" />
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <TaskRequestsView
            currentUser={user}
            rows={(rows ?? []) as any}
            people={allActive ?? []}
            approvers={approvers}
            canRequest={canRequest}
            canApprove={canApprove}
            pendingCount={pendingCount}
            currentStatus={status}
            forceMine={forceMine}
          />
        </div>
      </main>
    </div>
  );
}
