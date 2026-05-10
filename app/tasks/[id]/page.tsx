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

  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select(`
      *,
      assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name, email),
      created_by_profile:profiles!tasks_created_by_fkey(id, full_name)
    `)
    .eq('id', id)
    .single();

  if (!task) notFound();

  // Fetch updates and notes
  const { data: updates } = await supabaseAdmin
    .from('task_updates')
    .select('*, user:profiles(full_name, role)')
    .eq('task_id', id)
    .order('created_at', { ascending: false });

  const { data: notes } = await supabaseAdmin
    .from('task_notes')
    .select('*, user:profiles(full_name)')
    .eq('task_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 bg-gray-50">
        <TopBar user={user} title="Task Details" />
        <div className="p-6 max-w-5xl mx-auto">
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
