import { NextResponse } from 'next/server';
import { getCurrentUser, canEditBudget } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEditBudget(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { amount, source, category, received_date, notes } = await request.json();

  const { data, error } = await supabaseAdmin
    .from('income')
    .insert({
      amount: parseFloat(amount),
      source,
      category,
      received_date,
      notes,
      recorded_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
