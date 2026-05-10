import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { canUseCalculators } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import CalculatorsView from './CalculatorsView';

export default async function CalculatorsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canUseCalculators(user.role)) redirect('/');

  // Recent saved calculations (this user's only)
  const { data: recentCalcs } = await supabaseAdmin
    .from('client_calculations')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Client Calculators" />
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <CalculatorsView recentCalcs={recentCalcs || []} />
        </div>
      </main>
    </div>
  );
}
