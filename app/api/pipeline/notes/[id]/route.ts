import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isLeadership } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { is_pinned } = await request.json();

  const { data, error } = await supabaseAdmin
    .from('contact_notes')
    .update({ is_pinned: !!is_pinned })
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

  const { data: note } = await supabaseAdmin
    .from('contact_notes')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (note.user_id !== user.id && !isLeadership(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('contact_notes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
