import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/twilio';

// POST /api/twilio/transfer
//
// Body: {
//   call_sid: string,                     // The agent's (parent) leg SID
//   mode: 'blind' | 'merge',              // 'blind' = hand off and drop;
//                                         // 'merge' = 3-way conference
//   target: {
//     type: 'agent' | 'extension' | 'phone' | 'contact',
//     value: string                       // agent id / extension / phone / contact id
//   }
// }
//
// Blind transfer: the customer is reconnected to <target>; the agent drops.
// Merge: agent, customer, and target all join a Twilio Conference.
//
// Warm transfer (consult-then-connect) is not implemented yet — UI marks it
// as unavailable.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';
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

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { call_sid, mode, target } = body || {};
  if (!call_sid || !mode || !target?.type || !target?.value) {
    return NextResponse.json({ error: 'call_sid, mode, target.{type,value} required' }, { status: 400 });
  }
  if (!['blind', 'merge'].includes(mode)) {
    return NextResponse.json({ error: 'mode must be blind|merge' }, { status: 400 });
  }

  // ─── Resolve target → TwiML noun ───
  // Each target produces either a <Number>...</Number> or <Client>...</Client>.
  let twimlTarget: string;
  let targetLabel: string;
  try {
    const resolved = await resolveTarget(target);
    twimlTarget = resolved.twimlTarget;
    targetLabel = resolved.label;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not resolve target' }, { status: 400 });
  }

  const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

  try {
    // The browser passes its (parent) call SID. The customer is on the child
    // leg — we need to find it.
    const children = await client.calls.list({ parentCallSid: call_sid, limit: 5 });
    const customerLeg = children.find(c => c.status === 'in-progress') || children[0];
    if (!customerLeg) {
      return NextResponse.json({ error: 'No active customer leg found for this call' }, { status: 409 });
    }

    if (mode === 'blind') {
      // Redirect the customer to dial the target directly. Their existing
      // bridge to the agent ends; agent's browser will see disconnect.
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Transferring your call. Please hold.</Say>
  <Dial answerOnBridge="true" timeout="30">
    ${twimlTarget}
  </Dial>
</Response>`;
      await client.calls(customerLeg.sid).update({ twiml });

      return NextResponse.json({
        ok: true,
        mode: 'blind',
        target: targetLabel,
        customer_leg_sid: customerLeg.sid,
      });
    }

    // ─── Merge (3-way conference) ───
    // Conference name is scoped to this call so simultaneous transfers on
    // other calls don't collide. Twilio requires it to be a safe string.
    const conferenceName = `xfer-${call_sid}`.replace(/[^a-zA-Z0-9_\-]/g, '');

    // Note: `waitUrl=""` is a Twilio gotcha — it makes Twilio try to fetch
    // an empty URL for hold music and emits "Internal Application Error".
    // Omitting the attribute lets Twilio use its default hold music until
    // the conference starts. `startConferenceOnEnter` on both participants
    // means the music plays only briefly (until the second leg arrives).
    const conferenceTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false">${conferenceName}</Conference>
  </Dial>
</Response>`;

    // Order matters: move the CUSTOMER first. If we update the agent's
    // (parent) leg first, Twilio tears down the parent's existing <Dial>
    // and the customer's child leg gets hung up before it can be redirected.
    await client.calls(customerLeg.sid).update({ twiml: conferenceTwiml });
    await client.calls(call_sid).update({ twiml: conferenceTwiml });

    // Dial the target into the same conference. Use the agent's assigned
    // caller ID if we know it, else the company default.
    const { data: agentProfile } = await supabaseAdmin
      .from('profiles')
      .select('twilio_phone_number')
      .eq('id', user.id)
      .single();
    const callerId = agentProfile?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || '';

    // Inline TwiML — avoids any dependency on NEXT_PUBLIC_APP_URL being a
    // public HTTPS URL Twilio can reach (which is what was causing
    // "an application error has occurred" on the target leg).
    const dialIntoConferenceTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${conferenceName}</Conference>
  </Dial>
</Response>`;

    if (target.type === 'agent' || twimlTarget.includes('<Client>')) {
      const clientId = extractTagValue(twimlTarget, 'Client');
      if (!clientId) {
        return NextResponse.json({ error: 'Internal: bad client target' }, { status: 500 });
      }
      await client.calls.create({
        to: `client:${clientId}`,
        from: callerId,
        twiml: dialIntoConferenceTwiml,
      });
    } else {
      const phoneNumber = extractTagValue(twimlTarget, 'Number');
      if (!phoneNumber) {
        return NextResponse.json({ error: 'Internal: bad number target' }, { status: 500 });
      }
      await client.calls.create({
        to: phoneNumber,
        from: callerId,
        twiml: dialIntoConferenceTwiml,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: 'merge',
      target: targetLabel,
      conference: conferenceName,
    });
  } catch (e: any) {
    // Twilio API errors carry useful detail in .moreInfo / .code; surface
    // them so the agent sees something better than "Internal Application
    // Error" if a TwiML update bounces back.
    console.error('Transfer failed:', {
      message: e?.message,
      code: e?.code,
      status: e?.status,
      moreInfo: e?.moreInfo,
    });
    return NextResponse.json({
      error: e?.message || 'Transfer failed',
      twilio_code: e?.code,
    }, { status: 500 });
  }
}

function extractTagValue(twimlSnippet: string, tag: string): string | null {
  const m = twimlSnippet.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return m ? m[1] : null;
}

async function resolveTarget(target: { type: string; value: string }): Promise<{ twimlTarget: string; label: string }> {
  switch (target.type) {
    case 'agent': {
      const { data: agent } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .eq('id', target.value)
        .single();
      if (!agent) throw new Error('Agent not found');
      return { twimlTarget: `<Client>${agent.id}</Client>`, label: agent.full_name };
    }
    case 'extension': {
      const { data: agent } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, extension')
        .eq('extension', target.value)
        .single();
      if (!agent) throw new Error(`No agent with extension ${target.value}`);
      return { twimlTarget: `<Client>${agent.id}</Client>`, label: `${agent.full_name} (x${agent.extension})` };
    }
    case 'contact': {
      const { data: c } = await supabaseAdmin
        .from('internal_contacts')
        .select('id, name, phone, extension, profile_id')
        .eq('id', target.value)
        .single();
      if (!c) throw new Error('Contact not found');
      if (c.profile_id) return { twimlTarget: `<Client>${c.profile_id}</Client>`, label: c.name };
      if (c.phone) {
        const phone = normalizePhone(c.phone);
        if (!phone) throw new Error('Contact phone is invalid');
        return { twimlTarget: `<Number>${phone}</Number>`, label: `${c.name} (${phone})` };
      }
      throw new Error('Contact has no phone or agent link');
    }
    case 'phone': {
      const phone = normalizePhone(target.value);
      if (!phone) throw new Error('Invalid phone number');
      return { twimlTarget: `<Number>${phone}</Number>`, label: phone };
    }
    default:
      throw new Error('Unknown target type');
  }
}
