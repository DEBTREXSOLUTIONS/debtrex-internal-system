import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canUseCalculators } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canUseCalculators(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();

    if (!body.client_name || !body.calculation_type) {
      return NextResponse.json({ error: 'Client name and calculation type required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('client_calculations')
      .insert({
        created_by: user.id,
        client_name: body.client_name,
        client_email: body.client_email || null,
        client_phone: body.client_phone || null,
        calculation_type: body.calculation_type,
        monthly_gross_income: body.monthly_gross_income ?? null,
        monthly_debt_payments: body.monthly_debt_payments ?? null,
        dti_ratio: body.dti_ratio ?? null,
        dti_category: body.dti_category ?? null,
        monthly_net_income: body.monthly_net_income ?? null,
        total_monthly_expenses: body.total_monthly_expenses ?? null,
        monthly_disposable_income: body.monthly_disposable_income ?? null,
        expense_breakdown: body.expense_breakdown ?? null,
        debt_breakdown: body.debt_breakdown ?? null,
        total_debt: body.total_debt ?? null,
        recommended_program: body.recommended_program ?? null,
        estimated_monthly_payment: body.estimated_monthly_payment ?? null,
        estimated_savings: body.estimated_savings ?? null,
        notes: body.notes || null,
        enrollment_status: 'prospect',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
