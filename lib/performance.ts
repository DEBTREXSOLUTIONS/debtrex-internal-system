import 'server-only';
import { supabaseAdmin } from './supabase';

export interface PerformanceMetrics {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  not_started_tasks: number;
  overdue_tasks: number;
  total_hours_logged: number;
  on_time_completion_rate: number; // 0-100 percentage
  avg_completion_days: number | null;
  last_activity_at: string | null;
}

/**
 * Calculate performance metrics for a list of users.
 * Pass an array of user IDs. Returns metrics for each.
 */
export async function calculatePerformanceMetrics(userIds: string[]): Promise<PerformanceMetrics[]> {
  if (userIds.length === 0) return [];

  // Parallel fetch — users, their tasks, and their task updates
  const [usersRes, tasksRes, updatesRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role')
      .in('id', userIds),
    supabaseAdmin
      .from('tasks')
      .select('id, assigned_to, status, deadline, completed_at, created_at')
      .in('assigned_to', userIds),
    supabaseAdmin
      .from('task_updates')
      .select('user_id, hours_worked, created_at')
      .in('user_id', userIds),
  ]);

  const users = usersRes.data;
  const tasks = tasksRes.data;
  const updates = updatesRes.data;

  if (!users) return [];

  const now = new Date();

  return users.map(user => {
    const userTasks = (tasks || []).filter(t => t.assigned_to === user.id);
    const userUpdates = (updates || []).filter(u => u.user_id === user.id);

    const completed = userTasks.filter(t => t.status === 'completed');
    const inProgress = userTasks.filter(t => t.status === 'in_progress' || t.status === 'submitted');
    const notStarted = userTasks.filter(t => t.status === 'not_started');
    const overdue = userTasks.filter(t =>
      t.deadline && new Date(t.deadline) < now && t.status !== 'completed' && t.status !== 'cancelled'
    );

    const totalHours = userUpdates.reduce((sum, u) => sum + (parseFloat(String(u.hours_worked)) || 0), 0);

    // On-time rate: of all completed tasks with deadlines, what % were finished by the deadline?
    const completedWithDeadline = completed.filter(t => t.deadline && t.completed_at);
    const onTime = completedWithDeadline.filter(t =>
      new Date(t.completed_at!) <= new Date(t.deadline!)
    );
    const onTimeRate = completedWithDeadline.length > 0
      ? Math.round((onTime.length / completedWithDeadline.length) * 100)
      : 100; // No completed tasks with deadlines = treat as 100% (don't penalize)

    // Avg completion days: avg time from creation to completion
    let avgCompletionDays: number | null = null;
    if (completed.length > 0) {
      const totalDays = completed.reduce((sum, t) => {
        if (!t.completed_at) return sum;
        const days = (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0);
      avgCompletionDays = Math.round((totalDays / completed.length) * 10) / 10;
    }

    // Last activity = most recent task update
    const sortedUpdates = userUpdates.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastActivity = sortedUpdates[0]?.created_at || null;

    return {
      user_id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      total_tasks: userTasks.length,
      completed_tasks: completed.length,
      in_progress_tasks: inProgress.length,
      not_started_tasks: notStarted.length,
      overdue_tasks: overdue.length,
      total_hours_logged: Math.round(totalHours * 10) / 10,
      on_time_completion_rate: onTimeRate,
      avg_completion_days: avgCompletionDays,
      last_activity_at: lastActivity,
    };
  });
}

/**
 * For a manager, get the IDs of agents assigned to them.
 */
export async function getAgentsForManager(managerId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('manager_assignments')
    .select('agent_id')
    .eq('manager_id', managerId);
  return (data || []).map(a => a.agent_id);
}

/**
 * For an agent, get the IDs of managers overseeing them.
 */
export async function getManagersForAgent(agentId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('manager_assignments')
    .select('manager_id')
    .eq('agent_id', agentId);
  return (data || []).map(a => a.manager_id);
}
