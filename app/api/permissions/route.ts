import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission, invalidatePermissionCache } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'permissions.manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { updates } = await request.json();
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates must be an array' }, { status: 400 });
    }

    // Lock CEO/Owner permissions.manage permanently
    const filtered = updates.filter((u: any) =>
      !((u.role === 'ceo' || u.role === 'owner') && u.permission_key === 'permissions.manage' && !u.enabled)
    );

    // Upsert each row
    const rows = filtered.map((u: any) => ({
      role: u.role,
      permission_key: u.permission_key,
      enabled: !!u.enabled,
      updated_by: user.id,
    }));

    const { error } = await supabaseAdmin
      .from('role_permissions')
      .upsert(rows, { onConflict: 'role,permission_key' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Invalidate the cache so changes take effect immediately
    invalidatePermissionCache();

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'permissions_updated',
      details: { count: rows.length },
    });

    return NextResponse.json({ success: true, updated: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
