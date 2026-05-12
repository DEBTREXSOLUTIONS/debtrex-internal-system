import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import CalendarView from './CalendarView';

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Date window: only fetch events/deadlines within ±6 months of now.
  // FullCalendar can request more via its dateRange callback if the user
  // navigates far into past/future — but for the default view this keeps
  // the payload bounded.
  const windowStart = new Date();
  windowStart.setMonth(windowStart.getMonth() - 6);
  const windowEnd = new Date();
  windowEnd.setMonth(windowEnd.getMonth() + 6);

  // Parallel fetch
  const [eventsRes, tasksRes, usersRes] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, title, start_time, end_time, all_day, color')
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .order('start_time'),
    supabaseAdmin
      .from('tasks')
      .select('id, title, deadline, priority, status')
      .not('deadline', 'is', null)
      .neq('status', 'completed')
      .gte('deadline', windowStart.toISOString())
      .lte('deadline', windowEnd.toISOString()),
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  const events = eventsRes.data;
  const tasks = tasksRes.data;
  const users = usersRes.data;

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Calendar" />
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
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
