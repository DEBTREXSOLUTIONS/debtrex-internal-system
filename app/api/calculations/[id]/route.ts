import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isLeadership } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';

// Update enrollment status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Owner of the record OR leadership can update
  const { data: existing } = await supabaseAdmin
    .from('client_calculations')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.created_by !== user.id && !isLeadership(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allowed: any = {};
  if (body.enrollment_status) allowed.enrollment_status = body.enrollment_status;
  if (body.notes !== undefined) allowed.notes = body.notes;

  const { data, error } = await supabaseAdmin
    .from('client_calculations')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Same: owner or leadership
  const { data: existing } = await supabaseAdmin
    .from('client_calculations')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.created_by !== user.id && !isLeadership(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('client_calculations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
