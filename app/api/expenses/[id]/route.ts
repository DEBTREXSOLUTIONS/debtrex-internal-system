import { NextResponse } from 'next/server';
import { getCurrentUser, canApproveExpenses } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canApproveExpenses(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { status, rejection_reason } = await request.json();

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .update({
      status,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: `expense_${status}`,
    resource_type: 'expense',
    resource_id: id,
    details: { amount: data.amount },
  });

  return NextResponse.json(data);
}
