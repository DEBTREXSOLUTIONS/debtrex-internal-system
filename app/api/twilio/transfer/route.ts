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

  const { call_sid, mode, target, end_conference } = body || {};
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

      // If this blind was fired while a merge was in progress, agent A
      // is in a consult room with the previous merge target, and the
      // customer is in a hold room. Customer was just redirected out by
      // the TwiML update above — now end both rooms so agent A's leg AND
      // the previous merge target's leg both clean up.
      if (end_conference) {
        const sidSafe = call_sid.replace(/[^a-zA-Z0-9_\-]/g, '');
        await endConferenceByName(client, `hold-${sidSafe}`);
        await endConferenceByName(client, `consult-${sidSafe}`);
      }

      return NextResponse.json({
        ok: true,
        mode: 'blind',
        target: targetLabel,
        customer_leg_sid: customerLeg.sid,
      });
    }

    // ─── Merge (warm transfer setup) ───
    // Two conferences, both scoped to this call SID so concurrent transfers
    // on other calls don't collide:
    //   hold-XXX    — customer sits here with hold music, alone.
    //   consult-XXX — agent A + agent B (the target) talk privately here.
    //
    // The agent later clicks "Transfer" → /api/twilio/transfer/complete,
    // which moves the customer from the hold room into the consult room
    // and hangs up agent A's leg. Agent B + customer keep talking.
    const sidSafe = call_sid.replace(/[^a-zA-Z0-9_\-]/g, '');
    const holdRoom = `hold-${sidSafe}`;
    const consultRoom = `consult-${sidSafe}`;

    // Customer → hold conference. `startConferenceOnEnter="false"` keeps
    // hold music playing for them (Twilio's default music) until something
    // else joins. `endConferenceOnExit="true"` so the hold room collapses
    // as soon as the customer leaves it (during Transfer or hangup).
    const customerHoldTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false">${holdRoom}</Conference>
  </Dial>
</Response>`;

    // Agent A → consult conference. He'll be alone until Agent B joins.
    // `endConferenceOnExit="false"` because when agent A drops out to
    // complete the transfer, customer + agent B keep talking.
    const agentConsultTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false">${consultRoom}</Conference>
  </Dial>
</Response>`;

    // Order matters: customer FIRST. If we move agent A first, Twilio
    // tears down his original <Dial> and hangs up customer before we
    // can redirect them.
    await client.calls(customerLeg.sid).update({ twiml: customerHoldTwiml });
    await client.calls(call_sid).update({ twiml: agentConsultTwiml });

    // Dial the target into the same conference. Use the agent's assigned
    // caller ID if we know it, else the company default.
    const { data: agentProfile } = await supabaseAdmin
      .from('profiles')
      .select('twilio_phone_number')
      .eq('id', user.id)
      .single();
    const callerId = agentProfile?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || '';

    // Inline TwiML — avoids any dependency on NEXT_PUBLIC_APP_URL being a
    // public HTTPS URL Twilio can reach.
    //
    // Target joins the CONSULT room (with agent A). When agent A clicks
    // Transfer, customer is moved into this same consult room and agent A
    // drops, leaving customer + target talking.
    // `endConferenceOnExit="true"` on the target so the room ends when
    // they hang up — customer is then released cleanly.
    const dialIntoConferenceTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${consultRoom}</Conference>
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
      hold_room: holdRoom,
      consult_room: consultRoom,
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

// Find an in-progress conference by friendlyName and end it (kicks out
// every participant). Used to clean up after a blind-during-merge or a
// "complete transfer" drop-out.
async function endConferenceByName(client: ReturnType<typeof twilio>, name: string): Promise<void> {
  try {
    const confs = await client.conferences.list({
      friendlyName: name,
      status: 'in-progress',
      limit: 1,
    });
    if (confs[0]) {
      await client.conferences(confs[0].sid).update({ status: 'completed' });
    }
  } catch (e) {
    console.error('Failed to end conference', name, e);
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
