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

  // Role changes require team.change_roles; deactivate requires team.deactivate.
  if (body.role !== undefined) {
    if (!(await hasPermission(user.role, 'team.change_roles'))) {
      return NextResponse.json({ error: 'Forbidden — you need permission to change roles' }, { status: 403 });
    }
    // Promotion to CEO/Owner still locked to existing CEO/Owner only (hard rule)
    if (['ceo', 'owner'].includes(body.role) && !['ceo', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Only CEO or Owner can promote to that level' }, { status: 403 });
    }
  }

  if (body.is_active !== undefined) {
    if (!(await hasPermission(user.role, 'team.deactivate'))) {
      return NextResponse.json({ error: 'Forbidden — you need permission to deactivate users' }, { status: 403 });
    }
  }

  if ((body.full_name !== undefined || body.phone !== undefined) && body.role === undefined && body.is_active === undefined) {
    // Editing basic profile fields → require any team management permission
    const canAny = (await hasPermission(user.role, 'team.change_roles')) || (await hasPermission(user.role, 'team.deactivate'));
    if (!canAny) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Resetting 2FA (lost-device recovery) → require any team management permission.
  if (body.reset_2fa === true) {
    const canAny = (await hasPermission(user.role, 'team.change_roles')) || (await hasPermission(user.role, 'team.deactivate'));
    if (!canAny) {
      return NextResponse.json({ error: 'Forbidden — you need team management permission to reset 2FA' }, { status: 403 });
    }
  }

  // Don't allow modifying your own role / active status
  if (id === user.id && (body.role !== undefined || body.is_active !== undefined)) {
    return NextResponse.json({ error: 'Cannot change your own role or active status' }, { status: 400 });
  }

  const updates: any = {};
  if (body.role) updates.role = body.role;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.full_name) updates.full_name = body.full_name;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.reset_2fa === true) {
    // Clear enrollment so the user is forced to set up a new authenticator
    // on their next login.
    updates.totp_enabled = false;
    updates.totp_secret = null;
    updates.totp_enrolled_at = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

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

// ─── Permanent delete ───
// Hard-deletes the profile row. Foreign keys with `on delete set null` (assigned_to,
// created_by on tasks, etc.) will keep their referenced records but break the link.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'team.delete'))) {
    return NextResponse.json({ error: 'Forbidden — you need permission to permanently delete users' }, { status: 403 });
  }

  const { id } = await params;
  if (id === user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  // Block deleting CEO/Owner accounts unless you are CEO/Owner
  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, role, email, full_name')
    .eq('id', id)
    .single();

  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (['ceo', 'owner'].includes(target.role) && !['ceo', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'Only CEO or Owner can delete that account' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'user_deleted',
    resource_type: 'user',
    resource_id: id,
    details: { email: target.email, full_name: target.full_name, role: target.role },
  });

  return NextResponse.json({ success: true });
}
