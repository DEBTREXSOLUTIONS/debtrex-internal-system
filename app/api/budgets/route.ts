import { NextResponse } from 'next/server';
import { getCurrentUser, canEditBudget } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEditBudget(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { month, category, allocated_amount, notes } = await request.json();

    if (!month || !category || allocated_amount === undefined || allocated_amount === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amt = parseFloat(String(allocated_amount));
    if (isNaN(amt) || amt < 0) {
      return NextResponse.json({ error: 'Allocated amount must be a non-negative number' }, { status: 400 });
    }

    // Upsert: if (month, category) already exists, update it
    const { data, error } = await supabaseAdmin
      .from('budgets')
      .upsert(
        {
          month,
          category,
          allocated_amount: amt,
          notes: notes || null,
          created_by: user.id,
        },
        { onConflict: 'month,category' }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'budget_allocation_set',
      resource_type: 'budget',
      resource_id: data.id,
      details: { month, category, amount: amt },
    });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
