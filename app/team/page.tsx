import { redirect } from 'next/navigation';
import { getCurrentUser, canManageUsers } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TeamManager from './TeamManager';

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canManageUsers(user.role)) redirect('/');

  const { data: members } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, is_active, last_login_at, created_at, phone')
    .order('created_at', { ascending: false });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Team Management" />
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <TeamManager members={members || []} currentUser={user} />
        </div>
      </main>
    </div>
  );
}
