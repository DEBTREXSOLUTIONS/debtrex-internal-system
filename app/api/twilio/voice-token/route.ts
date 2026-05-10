import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { generateVoiceToken, isVoiceSdkConfigured } from '@/lib/twilio-voice';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'call.make')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!isVoiceSdkConfigured()) {
    return NextResponse.json({
      error: 'Voice SDK not configured. Need TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_TWIML_APP_SID. See the Browser Calling Setup Guide.'
    }, { status: 503 });
  }

  try {
    const token = generateVoiceToken(user.id);
    return NextResponse.json({ token, identity: user.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
