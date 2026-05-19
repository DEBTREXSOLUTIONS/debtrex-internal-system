import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

// Complete a warm transfer.
//
// State before this is called: agent A is in the consult room with the
// merge target; customer is in the hold room (on hold music).
//
// What this does:
//   1. Move the customer's leg from the hold room INTO the consult room.
//      (Customer + target are now connected.)
//   2. Hang up agent A's leg.
//
// Body: { call_sid }   — agent A's own call SID.

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
    const sidSafe = call_sid.replace(/[^a-zA-Z0-9_\-]/g, '');
    const consultRoom = `consult-${sidSafe}`;

    // Find the customer leg. Even though they've been redirected to a
    // conference, ParentCallSid stays pinned to the original outbound
    // call (call_sid), so this still resolves them.
    const children = await client.calls.list({ parentCallSid: call_sid, limit: 5 });
    const customerLeg = children.find(c => c.status === 'in-progress') || children[0];

    if (customerLeg) {
      // Move customer into the consult room. `endConferenceOnExit="true"`
      // so when the customer eventually hangs up the room collapses.
      const joinConsultTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${consultRoom}</Conference>
  </Dial>
</Response>`;
      await client.calls(customerLeg.sid).update({ twiml: joinConsultTwiml });
    }

    // Hang up agent A. We set status=completed via REST so this works
    // even if the local WebRTC hangup hasn't fired yet.
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
