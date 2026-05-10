import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import CalendarView from './CalendarView';

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Fetch events
  const { data: events } = await supabaseAdmin
    .from('events')
    .select('*')
    .order('start_time');

  // Fetch task deadlines as calendar items
  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('id, title, deadline, priority, status, assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name)')
    .not('deadline', 'is', null)
    .neq('status', 'completed');

  // Combine into calendar items
  const calendarItems = [
    ...(events || []).map(e => ({
      id: e.id,
      title: e.title,
      start: e.start_time,
      end: e.end_time,
      allDay: e.all_day,
      color: e.color,
      type: 'event',
      url: `/calendar?event=${e.id}`,
    })),
    ...(tasks || []).map((t: any) => ({
      id: 't-' + t.id,
      title: '📌 ' + t.title,
      start: t.deadline,
      allDay: true,
      color: t.priority === 'urgent' ? '#E02020' : '#999',
      type: 'task',
      url: `/tasks/${t.id}`,
    })),
  ];

  // Fetch users for event creation
  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .eq('is_active', true)
    .order('full_name');

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 bg-gray-50">
        <TopBar user={user} title="Calendar" />
        <div className="p-6 max-w-7xl mx-auto">
          <CalendarView
            events={calendarItems}
            users={users || []}
            currentUser={user}
          />
        </div>
      </main>
    </div>
  );
}
