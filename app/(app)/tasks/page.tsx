import { redirect } from 'next/navigation';
import { getCurrentUser, canViewAllTasks, isLeadership } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import { Plus, Filter, Clock, Inbox } from 'lucide-react';

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const filter = params.filter || 'mine';

  let query = supabaseAdmin
    .from('tasks')
    .select(`
      id, title, description, status, priority, deadline,
      assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter === 'mine') {
    query = query.eq('assigned_to', user.id);
  } else if (filter === 'created') {
    query = query.eq('created_by', user.id);
  } else if (filter === 'all' && !canViewAllTasks(user.role)) {
    query = query.eq('assigned_to', user.id);
  }

  const { data: tasks } = await query;

  // Pending task-requests count for the badge — only for approvers
  const canApprove = await hasPermission(user.role, 'task.approve_requests');
  const canRequest = await hasPermission(user.role, 'task.request');
  const canCreate = await hasPermission(user.role, 'task.create');
  let pendingReqCount = 0;
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
    pendingReqCount = count ?? 0;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {/* Header actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              <FilterTab href="/tasks?filter=mine" active={filter === 'mine'}>
                Assigned to Me
              </FilterTab>
              <FilterTab href="/tasks?filter=created" active={filter === 'created'}>
                Created by Me
              </FilterTab>
              {canViewAllTasks(user.role) && (
                <FilterTab href="/tasks?filter=all" active={filter === 'all'}>
                  All Tasks
                </FilterTab>
              )}
              {(canRequest || canApprove) && (
                <Link
                  href="/tasks/requests"
                  className="px-4 py-2 text-sm font-semibold rounded-md text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap flex-shrink-0 flex items-center gap-2"
                >
                  <Inbox size={14} /> Requests
                  {canApprove && pendingReqCount > 0 && (
                    <span className="badge badge-red">{pendingReqCount}</span>
                  )}
                </Link>
              )}
            </div>
            {canCreate ? (
              <Link href="/tasks/new" className="btn-primary self-start sm:self-auto">
                <Plus size={14} /> New Task
              </Link>
            ) : canRequest ? (
              <Link href="/tasks/requests" className="btn-primary self-start sm:self-auto">
                <Plus size={14} /> Request Task
              </Link>
            ) : null}
          </div>

          {canApprove && pendingReqCount > 0 && (
            <Link
              href="/tasks/requests"
              className="mb-6 flex items-center justify-between gap-3 p-4 bg-brand-blue-pale border border-brand-blue/30 rounded-md hover:border-brand-blue transition-colors"
            >
              <div className="flex items-center gap-3">
                <Inbox size={18} className="text-brand-blue" />
                <div>
                  <div className="font-semibold text-sm text-brand-blue">
                    {pendingReqCount} pending task request{pendingReqCount === 1 ? '' : 's'}
                  </div>
                  <div className="text-xs text-gray-600">Click to review and approve or deny.</div>
                </div>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">Open inbox →</span>
            </Link>
          )}

          {/* Tasks Grid */}
          {tasks && tasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task: any) => (
                <TaskListCard key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <div className="font-condensed text-2xl font-black uppercase mb-2">No Tasks Yet</div>
              <p className="text-gray-500 mb-4">
                {canCreate ? 'Get started by creating your first task.' : 'Request a task to get started.'}
              </p>
              {canCreate ? (
                <Link href="/tasks/new" className="btn-primary">
                  <Plus size={14} /> Create First Task
                </Link>
              ) : canRequest ? (
                <Link href="/tasks/requests" className="btn-primary">
                  <Plus size={14} /> Request a Task
                </Link>
              ) : null}
            </div>
          )}
    </div>
  );
}

function FilterTab({ href, active, children }: any) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
        active ? 'bg-brand-blue text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  );
}

function TaskListCard({ task }: any) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
  const statusColors: any = {
    not_started: 'badge-gray',
    in_progress: 'badge-blue',
    submitted: 'badge-yellow',
    completed: 'badge-green',
    overdue: 'badge-red',
    cancelled: 'badge-gray',
  };
  const priorityColors: any = {
    urgent: 'badge-red',
    high: 'badge-yellow',
    medium: 'badge-gray',
    low: 'badge-gray',
  };

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="card p-5 hover:border-brand-blue transition-all hover:shadow-md fade-in"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`badge ${priorityColors[task.priority] || 'badge-gray'}`}>
          {task.priority}
        </span>
        <span className={`badge ${isOverdue ? 'badge-red' : statusColors[task.status]}`}>
          {isOverdue ? '⚠ Overdue' : task.status.replace('_', ' ')}
        </span>
      </div>
      <h3 className="font-bold text-base mb-2 line-clamp-2">{task.title}</h3>
      {task.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{task.description}</p>
      )}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-[10px] font-bold">
            {task.assigned_to_profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>
          <span className="text-gray-700 font-semibold truncate">
            {task.assigned_to_profile?.full_name}
          </span>
        </div>
        {task.deadline && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-brand-blue font-bold' : 'text-gray-500'}`}>
            <Clock size={11} />
            {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
    </Link>
  );
}
