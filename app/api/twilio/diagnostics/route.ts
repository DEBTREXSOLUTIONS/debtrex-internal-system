import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'section.twilio_numbers')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const number = process.env.TWILIO_PHONE_NUMBER;
  const callerId = process.env.TWILIO_CALLER_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return NextResponse.json({
    twilio_configured: !!(sid && token && number),
    details: {
      TWILIO_ACCOUNT_SID: sid ? `${sid.substring(0, 10)}... (${sid.length} chars)` : '❌ MISSING',
      TWILIO_AUTH_TOKEN: token ? `set (${token.length} chars)` : '❌ MISSING',
      TWILIO_PHONE_NUMBER: number || '❌ MISSING',
      TWILIO_CALLER_ID: callerId || '(using TWILIO_PHONE_NUMBER as fallback)',
      NEXT_PUBLIC_APP_URL: appUrl || '❌ MISSING (defaults to http://localhost:3000)',
    },
    your_profile: {
      role: user.role,
      can_make_calls: user.role !== 'viewer' && user.role !== 'accountant',
      note: 'Check Settings → Profile to confirm your phone number is set',
    },
    webhooks_for_twilio_console: {
      status_callback: `${appUrl || 'YOUR_APP_URL'}/api/twilio/status`,
      twiml_dial: `${appUrl || 'YOUR_APP_URL'}/api/twilio/twiml/dial (set automatically per call)`,
      recording: `${appUrl || 'YOUR_APP_URL'}/api/twilio/recording (set automatically per call)`,
      amd: `${appUrl || 'YOUR_APP_URL'}/api/twilio/amd (set automatically per call)`,
    },
  });
}
