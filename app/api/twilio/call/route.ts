import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import { initiateCall, normalizePhone, isTwilioConfigured, getCallerIdForAgent } from '@/lib/twilio';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'call.make')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!isTwilioConfigured())
    return NextResponse.json({ error: 'Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to env.' }, { status: 503 });

  try {
    const { contact_id } = await request.json();

    // Get contact phone (the lead)
    const { data: contact } = await supabaseAdmin
      .from('pipeline_contacts')
      .select('phone, full_name')
      .eq('id', contact_id)
      .single();

    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    const leadPhone = normalizePhone(contact.phone);
    if (!leadPhone) return NextResponse.json({ error: 'Contact has no valid phone number' }, { status: 400 });

    // Get agent's personal phone (where Twilio will ring them first)
    const { data: agent } = await supabaseAdmin
      .from('profiles')
      .select('phone, full_name, twilio_phone_number')
      .eq('id', user.id)
      .single();

    if (!agent?.phone) {
      return NextResponse.json(
        { error: 'You have no personal phone on file. Add one in Settings → Profile.' },
        { status: 400 }
      );
    }
    const agentPersonalPhone = normalizePhone(agent.phone);
    if (!agentPersonalPhone) {
      return NextResponse.json({ error: 'Your phone number is in an invalid format. Use E.164 (+1XXXXXXXXXX).' }, { status: 400 });
    }

    // Determine which Twilio number to use as caller ID:
    //   - Agent's assigned Twilio number if set
    //   - Otherwise the company's default TWILIO_PHONE_NUMBER
    const callerId = await getCallerIdForAgent(user.id);
    if (!callerId) {
      return NextResponse.json(
        { error: 'No Twilio number available. Either set TWILIO_PHONE_NUMBER in env, or assign one to this agent in /team.' },
        { status: 500 }
      );
    }

    // Initiate the call
    const { callSid } = await initiateCall({
      toNumber: leadPhone,
      agentNumber: agentPersonalPhone,
      agentCallerId: callerId,
      contactId: contact_id,
    });

    // Pre-create a call log entry that webhooks will update
    await supabaseAdmin.from('call_logs').insert({
      contact_id,
      user_id: user.id,
      direction: 'outbound',
      outcome: 'no_answer',
      twilio_call_sid: callSid,
      notes: `Twilio click-to-call · Caller ID: ${callerId}`,
    });

    await supabaseAdmin
      .from('pipeline_contacts')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', contact_id);

    return NextResponse.json({ success: true, callSid, callerId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
