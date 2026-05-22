import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  verifyPassword,
  createPreAuthToken,
  isDeviceTrusted,
  buildLoggedInResponse,
} from '@/lib/auth';

// Stage 1 of login: verify the password, then decide the 2FA stage.
//
// Response `stage`:
//   'done'   — fully logged in (session cookie attached). Device was trusted.
//   'enroll' — password OK but no authenticator set up yet; client must enroll.
//   'verify' — password OK, enrolled, but this device needs an authenticator code.
//
// 'enroll' / 'verify' also return a short-lived `preAuth` token the client
// hands back to the matching /api/auth/2fa/* endpoint to finish logging in.
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Password OK — now the 2FA gate.
    if (!user.totp_enabled) {
      // 2FA is mandatory: no authenticator yet → force enrollment.
      return NextResponse.json({ stage: 'enroll', preAuth: createPreAuthToken(user.id) });
    }

    // Enrolled. If this device passed 2FA within the last 24h, skip the code.
    if (await isDeviceTrusted(user.id)) {
      return buildLoggedInResponse(user, { trustDevice: false, method: 'device_trusted' });
    }

    // Enrolled, but this device must present an authenticator code.
    return NextResponse.json({ stage: 'verify', preAuth: createPreAuthToken(user.id) });
  } catch (e: any) {
    return NextResponse.json({ error: 'Login failed: ' + e.message }, { status: 500 });
  }
}
