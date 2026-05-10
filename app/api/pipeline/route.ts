import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'pipeline.create')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();

    if (!body.full_name || !body.pipeline_type) {
      return NextResponse.json({ error: 'Name and type required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('pipeline_contacts')
      .insert({
        pipeline_type: body.pipeline_type,
        full_name: body.full_name,
        company_name: body.company_name || null,
        email: body.email || null,
        phone: body.phone || null,
        estimated_debt: body.estimated_debt ?? null,
        monthly_income: body.monthly_income ?? null,
        deal_value: body.deal_value ?? null,
        industry: body.industry || null,
        source: body.source || null,
        notes: body.notes || null,
        status: body.status || 'new',
        created_by: user.id,
        assigned_to: body.assigned_to || user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
