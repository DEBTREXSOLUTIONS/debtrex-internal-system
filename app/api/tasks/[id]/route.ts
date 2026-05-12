import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updates: any = { updated_at: new Date().toISOString() };
  if (body.status) {
    updates.status = body.status;
    if (body.status === 'in_progress') updates.started_at = new Date().toISOString();
    if (body.status === 'submitted') updates.submitted_at = new Date().toISOString();
    if (body.status === 'completed') updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log status change as an update
  if (body.status) {
    await supabaseAdmin.from('task_updates').insert({
      task_id: id,
      user_id: user.id,
      update_text: `Status changed to: ${body.status.replace('_', ' ')}`,
      status_change: body.status,
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'task.delete'))) {
    return NextResponse.json({ error: 'Forbidden — you need permission to delete tasks' }, { status: 403 });
  }

  const { id } = await params;

  // Read for audit log
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('title, assigned_to, created_by')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'task_deleted',
    resource_type: 'task',
    resource_id: id,
    details: task || {},
  });

  return NextResponse.json({ success: true });
}
