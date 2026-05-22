import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPreAuthToken } from '@/lib/auth';
import { generateTotpSecret, totpAuthUri } from '@/lib/totp';

// Step A of enrollment: generate a fresh TOTP secret for the user and return
// it as a QR code + manual-entry key. The secret is stored but stays inactive
// (totp_enabled = false) until the user confirms a code via /2fa/enroll.
export async function POST(request: Request) {
  let preAuth: unknown;
  try {
    preAuth = (await request.json()).preAuth;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (typeof preAuth !== 'string') {
    return NextResponse.json({ error: 'Missing pre-auth token' }, { status: 400 });
  }
  const userId = verifyPreAuthToken(preAuth);
  if (!userId) {
    return NextResponse.json({ error: 'Session expired — please sign in again' }, { status: 401 });
  }

  const { data: user, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, totp_enabled')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (user.totp_enabled) {
    return NextResponse.json({ error: 'Two-factor authentication is already set up' }, { status: 400 });
  }

  const secret = generateTotpSecret();
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ totp_secret: secret })
    .eq('id', userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const uri = totpAuthUri(secret, user.email);
  const qr = await QRCode.toDataURL(uri, { width: 240, margin: 1 });

  return NextResponse.json({ secret, qr });
}
