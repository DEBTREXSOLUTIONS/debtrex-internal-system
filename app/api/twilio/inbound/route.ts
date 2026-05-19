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
    // Find all online + unlocked agents (locked = currently on a call)
    const { data: online } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .eq('status', 'online')
      .eq('status_locked', false);

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

  // ─── Mode 3: Queue ───
  if (routing?.routing_mode === 'queue' && routing.queue_id) {
    const { data: queue } = await supabaseAdmin
      .from('call_queues')
      .select('id, name, strategy, ring_timeout_seconds, hold_music_url, is_active, members:call_queue_members(profile_id, priority)')
      .eq('id', routing.queue_id)
      .single();

    if (queue && queue.is_active && queue.members && queue.members.length > 0) {
      // Pick targets per strategy. Only online + unlocked members are
      // ringable. status_locked means already on a call.
      const memberIds = queue.members
        .sort((a: any, b: any) => (a.priority ?? 0) - (b.priority ?? 0))
        .map((m: any) => m.profile_id);

      const { data: ringable } = await supabaseAdmin
        .from('profiles')
        .select('id, status, status_locked')
        .in('id', memberIds)
        .eq('is_active', true)
        .eq('status', 'online')
        .eq('status_locked', false);

      if (ringable && ringable.length > 0) {
        let targets: string[];
        if (queue.strategy === 'round_robin' || queue.strategy === 'longest_idle') {
          // For now: pick the first ringable member ordered by member priority.
          // (longest_idle / true round-robin would require tracking last-served;
          //  that's a future enhancement.)
          const orderedRingable = memberIds.filter(id => ringable.some(r => r.id === id));
          targets = orderedRingable.slice(0, 1);
        } else {
          // all_ring
          targets = ringable.map(r => r.id);
        }

        const clientTags = targets.map(id => `<Client>${id}</Client>`).join('');
        const queueTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${queue.ring_timeout_seconds || 20}" answerOnBridge="true" action="${APP_URL}/api/twilio/inbound-fallback" record="record-from-answer-dual" recordingStatusCallback="${APP_URL}/api/twilio/recording">
    ${clientTags}
  </Dial>
</Response>`;
        return new Response(queueTwiml, { headers: { 'Content-Type': 'text/xml' } });
      }
    }
    // No queue / no ringable members → fall through to voicemail
  }

  // ─── Mode 4: Voicemail (default fallback) ───
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
