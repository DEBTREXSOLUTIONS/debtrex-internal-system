import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { canUseCalculators } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';
import CalculatorsView from './CalculatorsView';

export default async function CalculatorsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // Allow if section permission is on OR built-in role allows
  const allowed = await hasPermission(user.role, 'section.calculators') || canUseCalculators(user.role);
  if (!allowed) redirect('/');

  // Recent saved calculations (this user's only)
  const { data: recentCalcs } = await supabaseAdmin
    .from('client_calculations')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
            <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <CalculatorsView recentCalcs={recentCalcs || []} />
        </div>
  );
}
