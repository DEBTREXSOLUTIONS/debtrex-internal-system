import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import { initiateCall, normalizePhone, isTwilioConfigured } from '@/lib/twilio';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'call.make')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!isTwilioConfigured())
    return NextResponse.json({ error: 'Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to env.' }, { status: 503 });

  try {
    const { contact_id } = await request.json();

    // Get contact phone
    const { data: contact } = await supabaseAdmin
      .from('pipeline_contacts')
      .select('phone, full_name')
      .eq('id', contact_id)
      .single();

    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    const leadPhone = normalizePhone(contact.phone);
    if (!leadPhone) return NextResponse.json({ error: 'Contact has no valid phone number' }, { status: 400 });

    // Get agent's phone
    const { data: agent } = await supabaseAdmin
      .from('profiles')
      .select('phone, full_name')
      .eq('id', user.id)
      .single();

    if (!agent?.phone) {
      return NextResponse.json(
        { error: 'You have no phone number on file. Add one in Settings → Profile.' },
        { status: 400 }
      );
    }
    const agentPhone = normalizePhone(agent.phone);
    if (!agentPhone) {
      return NextResponse.json({ error: 'Your phone number is in an invalid format. Use E.164 (+1XXXXXXXXXX).' }, { status: 400 });
    }

    // Initiate Twilio call
    const { callSid } = await initiateCall({
      toNumber: leadPhone,
      agentNumber: agentPhone,
      contactId: contact_id,
    });

    // Pre-create a call log entry that webhook will update later
    await supabaseAdmin.from('call_logs').insert({
      contact_id,
      user_id: user.id,
      direction: 'outbound',
      outcome: 'no_answer', // Default; updated by webhook
      twilio_call_sid: callSid,
      notes: 'Twilio click-to-call initiated',
    });

    await supabaseAdmin
      .from('pipeline_contacts')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', contact_id);

    return NextResponse.json({ success: true, callSid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
