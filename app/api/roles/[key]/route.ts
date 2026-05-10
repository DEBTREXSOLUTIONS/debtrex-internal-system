import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isLeadership } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';
import { invalidatePermissionCache } from '@/lib/permissions';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isLeadership(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { key } = await params;
  const body = await request.json();

  // Check existence and prevent editing built-in roles
  const { data: existing } = await supabaseAdmin
    .from('custom_roles')
    .select('is_built_in')
    .eq('role_key', key)
    .single();

  if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  if (existing.is_built_in)
    return NextResponse.json({ error: 'Built-in roles cannot be edited' }, { status: 403 });

  const updates: any = {};
  if (body.label !== undefined) updates.label = body.label;
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.color !== undefined) updates.color = body.color;

  const { data, error } = await supabaseAdmin
    .from('custom_roles')
    .update(updates)
    .eq('role_key', key)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isLeadership(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { key } = await params;

  // Check if built-in
  const { data: role } = await supabaseAdmin
    .from('custom_roles')
    .select('is_built_in, label')
    .eq('role_key', key)
    .single();

  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  if (role.is_built_in)
    return NextResponse.json({ error: 'Built-in roles cannot be deleted' }, { status: 403 });

  // Check users
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', key);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `${count} users still have this role. Change their role first.` },
      { status: 409 }
    );
  }

  // Delete role and its permissions
  await supabaseAdmin.from('role_permissions').delete().eq('role', key);
  const { error } = await supabaseAdmin.from('custom_roles').delete().eq('role_key', key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidatePermissionCache();

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'custom_role_deleted',
    resource_type: 'role',
    details: { role_key: key, label: role.label },
  });

  return NextResponse.json({ success: true });
}
