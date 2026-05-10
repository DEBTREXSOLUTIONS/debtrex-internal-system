import { NextResponse } from 'next/server';
import { getCurrentUser, canEditBudget } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEditBudget(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { month } = await request.json();
    if (!month) return NextResponse.json({ error: 'Month required' }, { status: 400 });

    // Calculate previous month
    const target = new Date(month + 'T00:00:00');
    const prev = new Date(target);
    prev.setMonth(prev.getMonth() - 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`;

    // Fetch previous month allocations
    const { data: prevAllocations } = await supabaseAdmin
      .from('budgets')
      .select('category, allocated_amount, notes')
      .eq('month', prevMonth);

    if (!prevAllocations || prevAllocations.length === 0) {
      return NextResponse.json({ error: 'No allocations found for previous month' }, { status: 404 });
    }

    // Find which categories already exist for target month so we don't overwrite
    const { data: existing } = await supabaseAdmin
      .from('budgets')
      .select('category')
      .eq('month', month);

    const existingCategories = new Set((existing || []).map((e: any) => e.category));
    const toInsert = prevAllocations
      .filter((a: any) => !existingCategories.has(a.category))
      .map((a: any) => ({
        month,
        category: a.category,
        allocated_amount: a.allocated_amount,
        notes: a.notes,
        created_by: user.id,
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({ copied: 0, message: 'All categories already set for this month' });
    }

    const { error } = await supabaseAdmin.from('budgets').insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ copied: toInsert.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
