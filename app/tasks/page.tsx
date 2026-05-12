import { redirect } from 'next/navigation';
import { getCurrentUser, canViewAllTasks } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import Link from 'next/link';
import { Plus, Filter, Clock } from 'lucide-react';

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Tasks" />
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
            </div>
            <Link href="/tasks/new" className="btn-primary self-start sm:self-auto">
              <Plus size={14} /> New Task
            </Link>
          </div>

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
              <p className="text-gray-500 mb-4">Get started by creating your first task.</p>
              <Link href="/tasks/new" className="btn-primary">
                <Plus size={14} /> Create First Task
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FilterTab({ href, active, children }: any) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
        active ? 'bg-brand-red text-white' : 'text-gray-600 hover:bg-gray-100'
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
      className="card p-5 hover:border-brand-red transition-all hover:shadow-md fade-in"
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
          <div className="w-6 h-6 rounded-full bg-brand-red text-white flex items-center justify-center text-[10px] font-bold">
            {task.assigned_to_profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>
          <span className="text-gray-700 font-semibold truncate">
            {task.assigned_to_profile?.full_name}
          </span>
        </div>
        {task.deadline && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-brand-red font-bold' : 'text-gray-500'}`}>
            <Clock size={11} />
            {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
    </Link>
  );
}
