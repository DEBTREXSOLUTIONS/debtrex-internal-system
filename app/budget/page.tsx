import { redirect } from 'next/navigation';
import { getCurrentUser, canEditBudget } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import BudgetDashboard from './BudgetDashboard';

export default async function BudgetPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const allowed = await hasPermission(user.role, 'section.budget') || canEditBudget(user.role);
  if (!allowed) redirect('/');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Parallel fetch — expenses, income, monthly budget allocations
  const [expensesRes, incomeRes, budgetsRes] = await Promise.all([
    supabaseAdmin
      .from('expenses')
      .select('*, paid_by_profile:profiles!expenses_paid_by_fkey(full_name)')
      .order('expense_date', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('income')
      .select('*')
      .order('received_date', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('budgets')
      .select('*')
      .eq('month', monthStart.toISOString().split('T')[0]),
  ]);

  const expenses = expensesRes.data;
  const income = incomeRes.data;
  const budgets = budgetsRes.data;

  // Calculations
  const totalIncome = income?.reduce((sum, i) => sum + parseFloat(i.amount), 0) || 0;
  const totalExpenses = expenses?.filter(e => e.status === 'approved').reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;
  const balance = totalIncome - totalExpenses;

  const monthSpent = expenses
    ?.filter(e => {
      const d = new Date(e.expense_date);
      return e.status === 'approved' && d >= monthStart && d <= monthEnd;
    })
    .reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;

  const monthBudget = budgets?.reduce((sum, b) => sum + parseFloat(b.allocated_amount), 0) || 0;

  // Pending approvals
  const pendingExpenses = expenses?.filter(e => e.status === 'submitted') || [];

  // Spent by category this month
  const byCategory: Record<string, number> = {};
  expenses?.filter(e => {
    const d = new Date(e.expense_date);
    return e.status === 'approved' && d >= monthStart && d <= monthEnd;
  }).forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + parseFloat(e.amount);
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <TopBar user={user} title="Budget Tracker" />
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <BudgetDashboard
            user={user}
            stats={{
              balance,
              monthBudget,
              monthSpent,
              monthRemaining: monthBudget - monthSpent,
              totalIncome,
              totalExpenses,
            }}
            expenses={expenses || []}
            income={income || []}
            budgets={budgets || []}
            byCategory={byCategory}
            pendingExpenses={pendingExpenses}
          />
        </div>
      </main>
    </div>
  );
}
