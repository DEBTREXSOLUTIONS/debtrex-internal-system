import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import NewTaskForm from './NewTaskForm';

export default async function NewTaskPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('is_active', true)
    .order('full_name');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Create New Task" />
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
          <NewTaskForm users={users || []} currentUser={user} />
        </div>
      </main>
    </div>
  );
}
