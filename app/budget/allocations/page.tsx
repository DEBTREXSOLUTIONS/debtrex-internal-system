import { redirect } from 'next/navigation';
import { getCurrentUser, canEditBudget } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import BudgetAllocations from './BudgetAllocations';

export default async function AllocationsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canEditBudget(user.role)) redirect('/');

  const params = await searchParams;
  // Default to first day of current month
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const month = params.month || defaultMonth;

  // Fetch allocations for this month
  const { data: allocations } = await supabaseAdmin
    .from('budgets')
    .select('*')
    .eq('month', month)
    .order('category');

  // Fetch this month's actual spend per category
  const monthStart = new Date(month);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const { data: spent } = await supabaseAdmin
    .from('expenses')
    .select('category, amount')
    .eq('status', 'approved')
    .gte('expense_date', monthStart.toISOString().split('T')[0])
    .lt('expense_date', monthEnd.toISOString().split('T')[0]);

  const spentByCategory: Record<string, number> = {};
  spent?.forEach(e => {
    spentByCategory[e.category] = (spentByCategory[e.category] || 0) + parseFloat(e.amount);
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 bg-gray-50">
        <TopBar user={user} title="Monthly Budget Allocations" />
        <div className="p-6 max-w-5xl mx-auto">
          <BudgetAllocations
            month={month}
            allocations={allocations || []}
            spentByCategory={spentByCategory}
          />
        </div>
      </main>
    </div>
  );
}
