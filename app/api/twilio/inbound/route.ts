import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Twilio hits this URL when an INBOUND call arrives at one of our numbers.
// We return TwiML telling Twilio how to route the call:
//   1. Look up the routing config for the dialed number
//   2. If routed to a specific agent → ring that agent's browser client
//   3. If "available" mode → ring all online agents
//   4. Otherwise → go straight to voicemail

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export async function POST(request: Request) {
  const formData = await request.formData();
  const callSid = formData.get('CallSid')?.toString() || '';
  const from = formData.get('From')?.toString() || '';
  const to = formData.get('To')?.toString() || ''; // The Twilio number that was dialed

  // Pre-log the inbound call so we have a record even if no one answers
  await supabaseAdmin.from('call_logs').insert({
    direction: 'inbound',
    outcome: 'no_answer',
    twilio_call_sid: callSid,
    from_number: from,
    to_number: to,
    notes: 'Inbound call received',
  });

  // Look up routing config for this Twilio number
  const { data: routing } = await supabaseAdmin
    .from('phone_number_routing')
    .select('*')
    .eq('twilio_phone_number', to)
    .single();

  const ringTimeout = routing?.ring_timeout_seconds || 20;
  const voicemailMsg = routing?.voicemail_message
    || 'Thank you for calling DEBTREX Solutions. Please leave a message and we will return your call.';

  // ─── Mode 1: Specific agent ───
  if (routing?.routing_mode === 'agent' && routing.primary_agent_id) {
    // Check agent is online — otherwise straight to voicemail
    const { data: agent } = await supabaseAdmin
      .from('profiles')
      .select('id, status')
      .eq('id', routing.primary_agent_id)
      .single();

    if (agent?.status === 'online') {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${ringTimeout}" answerOnBridge="true" action="${APP_URL}/api/twilio/inbound-fallback" record="record-from-answer-dual" recordingStatusCallback="${APP_URL}/api/twilio/recording">
    <Client>${agent.id}</Client>
  </Dial>
</Response>`;
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }
    // Agent not online → fall through to voicemail
  }

  // ─── Mode 2: Any available agent (round-robin) ───
  if (routing?.routing_mode === 'available') {
    // Find all online agents
    const { data: online } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .eq('status', 'online');

    if (online && online.length > 0) {
      // Build a <Client> element for each online agent — Twilio rings them all
      const clientTags = online.map(a => `<Client>${a.id}</Client>`).join('');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${ringTimeout}" answerOnBridge="true" action="${APP_URL}/api/twilio/inbound-fallback" record="record-from-answer-dual" recordingStatusCallback="${APP_URL}/api/twilio/recording">
    ${clientTags}
  </Dial>
</Response>`;
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }
    // No one online → voicemail
  }

  // ─── Mode 3: Voicemail (default fallback) ───
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${voicemailMsg}</Say>
  <Record maxLength="180" transcribe="false" recordingStatusCallback="${APP_URL}/api/twilio/voicemail" />
  <Say voice="alice">Thank you. Goodbye.</Say>
  <Hangup />
</Response>`;
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function GET(request: Request) {
  return POST(request);
}
