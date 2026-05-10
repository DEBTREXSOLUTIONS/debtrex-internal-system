import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { update_text, hours_worked } = await request.json();

  if (!update_text?.trim()) {
    return NextResponse.json({ error: 'Update text required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('task_updates')
    .insert({
      task_id: id,
      user_id: user.id,
      update_text,
      hours_worked: hours_worked || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-mark task as in_progress if it was not_started
  await supabaseAdmin
    .from('tasks')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'not_started');

  return NextResponse.json(data);
}
