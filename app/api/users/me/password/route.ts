import { NextResponse } from 'next/server';
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { current_password, new_password } = await request.json();

  if (!current_password || !new_password) {
    return NextResponse.json({ error: 'Both passwords required' }, { status: 400 });
  }

  if (new_password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  // Get current hash
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('password_hash')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const valid = await verifyPassword(current_password, profile.password_hash);
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });

  const newHash = await hashPassword(new_password);
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ password_hash: newHash })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'password_changed',
  });

  return NextResponse.json({ success: true });
}
