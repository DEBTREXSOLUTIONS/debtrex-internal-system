import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'call.log')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: contact_id } = await params;
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from('call_logs')
    .insert({
      contact_id,
      user_id: user.id,
      direction: body.direction || 'outbound',
      outcome: body.outcome,
      duration_seconds: body.duration_seconds || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update last_contacted_at on the contact
  await supabaseAdmin
    .from('pipeline_contacts')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', contact_id);

  return NextResponse.json(data);
}
