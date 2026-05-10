import { NextResponse } from 'next/server';
import { getCurrentUser, canManageUsers, hashPassword } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendUserInvitedEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageUsers(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { email, full_name, role, phone } = await request.json();

    if (!email || !full_name) {
      return NextResponse.json({ error: 'Email and name required' }, { status: 400 });
    }

    // Generate temp password
    const tempPassword = crypto.randomBytes(8).toString('base64').slice(0, 10);
    const passwordHash = await hashPassword(tempPassword);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name,
        role: role || 'employee',
        phone,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await sendUserInvitedEmail(email, full_name, tempPassword, user.full_name);

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'user_invited',
      resource_type: 'user',
      resource_id: data.id,
      details: { email, role },
    });

    return NextResponse.json({
      user: data,
      password: tempPassword,
      email,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
