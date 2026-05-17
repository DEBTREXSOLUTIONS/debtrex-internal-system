import { NextResponse } from 'next/server';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'team.invite'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const login = String(username).toLowerCase().trim();
    if (!login) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        email: login,
        password_hash: passwordHash,
        full_name: login,
        role: 'employee',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'A user with this username already exists' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'temp_user_created',
      resource_type: 'user',
      resource_id: data.id,
      details: { username: login },
    });

    return NextResponse.json({ user: data, username: login });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
