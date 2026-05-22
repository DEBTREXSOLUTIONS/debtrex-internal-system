import { NextResponse } from 'next/server';
import { getCurrentUser, clearSessionCookieOnResponse } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    // A logged-off user is no longer present — flip presence to offline and
    // release any call lock so they don't appear stuck online.
    await supabaseAdmin
      .from('profiles')
      .update({
        status: 'offline',
        status_updated_at: new Date().toISOString(),
        status_locked: false,
      })
      .eq('id', user.id);

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'logout',
    });
  }

  // Note: the device-trust cookie (debtrex_2fa) is intentionally NOT cleared —
  // 2FA is required once per 24h, not on every sign-in.
  const response = NextResponse.json({ success: true });
  return clearSessionCookieOnResponse(response);
}
