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
    const body = await request.json();
    const password = body.password;
    const username = body.username ? String(body.username).toLowerCase().trim() : '';
    const email = body.email ? String(body.email).toLowerCase().trim() : '';
    const full_name = body.full_name ? String(body.full_name).trim() : '';
    const role = body.role || 'employee';

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }
    if (!username && !email) {
      return NextResponse.json({ error: 'Username or email required' }, { status: 400 });
    }

    const login = email || username;
    const displayName = full_name || username || email;

    const passwordHash = await hashPassword(password);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        email: login,
        password_hash: passwordHash,
        full_name: displayName,
        role,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'An account with this username/email already exists' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'account_created',
      resource_type: 'user',
      resource_id: data.id,
      details: { login, mode: email ? 'email' : 'username' },
    });

    return NextResponse.json({ user: data, login });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
