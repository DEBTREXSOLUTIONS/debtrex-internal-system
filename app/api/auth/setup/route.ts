import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, createSessionToken, attachSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Verify there are no users yet
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Setup already completed. Use /login.' },
        { status: 403 }
      );
    }

    const { email, password, full_name } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Email, password, and full name required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name,
        role: 'ceo',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from('audit_log').insert({
      user_id: data.id,
      action: 'system_setup',
      details: { email },
    });

    const token = createSessionToken(data);

    const response = NextResponse.json({
      message: 'Setup complete! You are now logged in as CEO.',
      user: { id: data.id, email: data.email, full_name: data.full_name, role: data.role },
    });

    return attachSessionCookie(response, token);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
