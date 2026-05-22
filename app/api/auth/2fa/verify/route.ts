import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPreAuthToken, buildLoggedInResponse } from '@/lib/auth';
import { verifyTotp } from '@/lib/totp';

// Stage 2 of login for an already-enrolled user on an untrusted device:
// verify the authenticator code, then complete the login and trust the device
// for 24h.
export async function POST(request: Request) {
  let preAuth: unknown, code: unknown;
  try {
    const body = await request.json();
    preAuth = body.preAuth;
    code = body.code;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (typeof preAuth !== 'string' || typeof code !== 'string') {
    return NextResponse.json({ error: 'Pre-auth token and code required' }, { status: 400 });
  }
  const userId = verifyPreAuthToken(preAuth);
  if (!userId) {
    return NextResponse.json({ error: 'Session expired — please sign in again' }, { status: 401 });
  }

  const { data: user, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, is_active, totp_secret, totp_enabled')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!user.is_active) {
    return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
  }
  if (!user.totp_enabled || !user.totp_secret) {
    return NextResponse.json({ error: 'Two-factor authentication is not set up' }, { status: 400 });
  }

  if (!verifyTotp(user.totp_secret, code)) {
    return NextResponse.json({ error: 'Invalid code — check your authenticator app and try again' }, { status: 400 });
  }

  return buildLoggedInResponse(user, { trustDevice: true, method: 'totp' });
}
