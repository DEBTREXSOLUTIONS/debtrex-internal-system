import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TaskWorkTracker from './TaskWorkTracker';
import Link from 'next/link';
import { ArrowLeft, Clock, Calendar, User, Flag } from 'lucide-react';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  // Parallel fetch — task, its updates, and its notes
  const [taskRes, updatesRes, notesRes] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select(`
        *,
        assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name, email),
        created_by_profile:profiles!tasks_created_by_fkey(id, full_name)
      `)
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('task_updates')
      .select('*, user:profiles(full_name, role)')
      .eq('task_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('task_notes')
      .select('*, user:profiles(full_name)')
      .eq('task_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const task = taskRes.data;
  const updates = updatesRes.data;
  const notes = notesRes.data;

  if (!task) notFound();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Task Details" />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <Link href="/tasks" className="btn-ghost mb-4">
            <ArrowLeft size={14} /> Back to Tasks
          </Link>

          <TaskWorkTracker
            task={task}
            initialUpdates={updates || []}
            initialNotes={notes || []}
            currentUser={user}
          />
        </div>
      </main>
    </div>
  );
}
