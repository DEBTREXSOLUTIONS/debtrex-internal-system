import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { hasPermission, invalidatePermissionCache, PERMISSION_KEYS } from '@/lib/permissions';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'roles.manage')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { role_key, label, description, color } = await request.json();

    if (!role_key || !label) {
      return NextResponse.json({ error: 'Role key and label required' }, { status: 400 });
    }

    // Validate role_key format
    if (!/^[a-z0-9-]{2,30}$/.test(role_key)) {
      return NextResponse.json({ error: 'Role key must be 2-30 lowercase letters, numbers, or hyphens' }, { status: 400 });
    }

    // Check for duplicates
    const { data: existing } = await supabaseAdmin
      .from('custom_roles')
      .select('id')
      .eq('role_key', role_key)
      .single();

    if (existing) {
      return NextResponse.json({ error: `Role "${role_key}" already exists` }, { status: 409 });
    }

    // Insert custom role
    const { data, error } = await supabaseAdmin
      .from('custom_roles')
      .insert({
        role_key,
        label,
        description: description || null,
        color: color || 'gray',
        is_built_in: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Seed default permissions (all OFF) so the role appears in /permissions
    const seedRows = PERMISSION_KEYS.map(key => ({
      role: role_key,
      permission_key: key,
      enabled: false,
      updated_by: user.id,
    }));
    await supabaseAdmin
      .from('role_permissions')
      .upsert(seedRows, { onConflict: 'role,permission_key' });

    invalidatePermissionCache();

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'custom_role_created',
      resource_type: 'role',
      details: { role_key, label },
    });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
