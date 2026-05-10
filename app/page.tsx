import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import Link from 'next/link';
import { CheckSquare, Clock, AlertCircle, TrendingUp, Calendar, Plus, ArrowRight, Users } from 'lucide-react';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Fetch user's tasks
  const { data: myTasks } = await supabaseAdmin
    .from('tasks')
    .select(`
      *,
      assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name, email),
      created_by_profile:profiles!tasks_created_by_fkey(full_name)
    `)
    .eq('assigned_to', user.id)
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .order('deadline', { ascending: true })
    .limit(5);

  // Recent updates from user
  const { data: recentUpdates } = await supabaseAdmin
    .from('task_updates')
    .select('*, task:tasks(title, id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  // Today's events
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: todayEvents } = await supabaseAdmin
    .from('events')
    .select('*')
    .gte('start_time', today.toISOString())
    .lt('start_time', tomorrow.toISOString())
    .order('start_time')
    .limit(3);

  // Stats
  const overdueCount = myTasks?.filter(t =>
    t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed'
  ).length || 0;

  const inProgressCount = myTasks?.filter(t => t.status === 'in_progress').length || 0;
  const totalOpen = myTasks?.length || 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 bg-gray-50">
        <TopBar user={user} title="Dashboard" />
        <div className="p-6 max-w-7xl mx-auto">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              icon={CheckSquare}
              label="Open Tasks"
              value={totalOpen.toString()}
              color="red"
            />
            <KPICard
              icon={Clock}
              label="In Progress"
              value={inProgressCount.toString()}
              color="blue"
            />
            <KPICard
              icon={AlertCircle}
              label="Overdue"
              value={overdueCount.toString()}
              color={overdueCount > 0 ? 'red' : 'gray'}
            />
            <KPICard
              icon={Calendar}
              label="Today's Events"
              value={(todayEvents?.length || 0).toString()}
              color="gray"
            />
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* My Tasks - 2 cols */}
            <div className="lg:col-span-2">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-condensed text-xl font-black uppercase">My Open Tasks</h2>
                  <Link href="/tasks" className="btn-ghost">
                    View all <ArrowRight size={14} />
                  </Link>
                </div>
                {myTasks && myTasks.length > 0 ? (
                  <div className="space-y-3">
                    {myTasks.map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={CheckSquare}
                    title="No open tasks"
                    message="You're all caught up! Create a new task or wait for one to be assigned."
                    action={
                      <Link href="/tasks/new" className="btn-primary mt-4">
                        <Plus size={14} /> Create Task
                      </Link>
                    }
                  />
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Today's Events */}
              <div className="card p-6">
                <h2 className="font-condensed text-xl font-black uppercase mb-4">Today's Events</h2>
                {todayEvents && todayEvents.length > 0 ? (
                  <div className="space-y-3">
                    {todayEvents.map(event => (
                      <div key={event.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
                        <div className="flex-shrink-0 text-center w-12">
                          <div className="text-xs font-bold text-gray-500 uppercase">
                            {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{event.title}</div>
                          {event.location && (
                            <div className="text-xs text-gray-500 truncate">{event.location}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No events scheduled today.</p>
                )}
                <Link href="/calendar" className="btn-ghost mt-4">
                  View calendar <ArrowRight size={14} />
                </Link>
              </div>

              {/* Recent Activity */}
              <div className="card p-6">
                <h2 className="font-condensed text-xl font-black uppercase mb-4">My Recent Activity</h2>
                {recentUpdates && recentUpdates.length > 0 ? (
                  <div className="space-y-3 text-sm">
                    {recentUpdates.map((update: any) => (
                      <div key={update.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
                        <div className="w-2 h-2 rounded-full bg-brand-red mt-1.5 flex-shrink-0"/>
                        <div className="flex-1 min-w-0">
                          <Link href={`/tasks/${update.task?.id}`} className="font-semibold hover:text-brand-red truncate block">
                            {update.task?.title}
                          </Link>
                          <div className="text-xs text-gray-600 line-clamp-2">{update.update_text}</div>
                          <div className="text-[11px] text-gray-400 mt-1">
                            {new Date(update.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No recent activity.</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="card p-6">
                <h2 className="font-condensed text-xl font-black uppercase mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/tasks/new" className="btn-outline text-xs">
                    <Plus size={12} /> Task
                  </Link>
                  <Link href="/calendar?new=1" className="btn-outline text-xs">
                    <Plus size={12} /> Event
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, color }: any) {
  const colors = {
    red: 'bg-brand-red-pale text-brand-red border-brand-red/20',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <div className="card p-5 fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-md border ${colors[color as keyof typeof colors]}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="font-condensed text-3xl font-black">{value}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-1">{label}</div>
    </div>
  );
}

function TaskCard({ task }: any) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
  const statusColors: any = {
    not_started: 'badge-gray',
    in_progress: 'badge-blue',
    submitted: 'badge-yellow',
    completed: 'badge-green',
    overdue: 'badge-red',
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
      className="block p-4 border border-gray-200 rounded-md hover:border-brand-red transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-sm flex-1">{task.title}</h3>
        <span className={`badge ${priorityColors[task.priority] || 'badge-gray'}`}>
          {task.priority}
        </span>
      </div>
      {task.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className={`badge ${isOverdue ? 'badge-red' : statusColors[task.status]}`}>
          {isOverdue ? 'Overdue' : task.status.replace('_', ' ')}
        </span>
        {task.deadline && (
          <span className={`text-xs ${isOverdue ? 'text-brand-red font-bold' : 'text-gray-500'}`}>
            <Clock size={11} className="inline mr-1" />
            Due {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ icon: Icon, title, message, action }: any) {
  return (
    <div className="text-center py-10">
      <Icon size={32} className="mx-auto text-gray-300 mb-3" />
      <h3 className="font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{message}</p>
      {action}
    </div>
  );
}
