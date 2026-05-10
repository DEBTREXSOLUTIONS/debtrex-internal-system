import { NextResponse } from 'next/server';
import { getCurrentUser, canManageUsers, canDeleteUsers } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageUsers(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  // Prevent demoting CEO/Owner unless you are CEO/Owner
  if (body.role && ['ceo', 'owner'].includes(body.role) && !canDeleteUsers(user.role)) {
    return NextResponse.json({ error: 'Only CEO or Owner can promote to that level' }, { status: 403 });
  }

  // Don't allow modifying yourself's role
  if (id === user.id && body.role) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }

  const updates: any = {};
  if (body.role) updates.role = body.role;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.full_name) updates.full_name = body.full_name;
  if (body.phone !== undefined) updates.phone = body.phone;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'user_updated',
    resource_type: 'user',
    resource_id: id,
    details: updates,
  });

  return NextResponse.json(data);
}
