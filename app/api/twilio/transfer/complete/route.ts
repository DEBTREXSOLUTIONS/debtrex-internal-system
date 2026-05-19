import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

// Complete a warm transfer (drop the agent out of a merged 3-way).
// Customer + merge target stay connected in the conference; agent's leg
// is hung up.
//
// Body: { call_sid }   — agent's own call SID

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'call.transfer')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 });
  }

  let call_sid: string;
  try {
    const body = await request.json();
    call_sid = body.call_sid;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!call_sid) {
    return NextResponse.json({ error: 'call_sid required' }, { status: 400 });
  }

  const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

  try {
    // Hang up just the agent's leg. Customer + target's legs both have
    // endConferenceOnExit semantics that keep the conference alive without
    // the agent (customer: false; target: true — but target staying means
    // customer + target keep talking until target hangs up).
    await client.calls(call_sid).update({ status: 'completed' });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Complete transfer failed:', {
      message: e?.message,
      code: e?.code,
    });
    return NextResponse.json({
      error: e?.message || 'Failed to complete transfer',
      twilio_code: e?.code,
    }, { status: 500 });
  }
}
