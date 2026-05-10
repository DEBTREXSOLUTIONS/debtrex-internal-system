import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAssignAgentsToManagers } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAssignAgentsToManagers(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from('manager_assignments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'manager_assignment_deleted',
    resource_type: 'manager_assignment',
    resource_id: id,
  });

  return NextResponse.json({ success: true });
}
