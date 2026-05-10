import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendExpenseSubmittedEmail } from '@/lib/email';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { amount, category, description, vendor, payment_method, expense_date } = body;

    if (!amount || !category || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .insert({
        amount: parseFloat(amount),
        category,
        description,
        vendor,
        payment_method,
        expense_date,
        paid_by: user.id,
        status: 'submitted',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify CEO/Owner of pending expense
    const { data: approvers } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, notification_preferences')
      .in('role', ['ceo', 'owner', 'co-owner', 'accountant']);

    for (const approver of approvers || []) {
      if (approver.notification_preferences?.expense_status !== false) {
        await sendExpenseSubmittedEmail(approver.email, approver.full_name, data, user.full_name);
      }
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
