import { supabaseAdmin } from '@/lib/supabase';

// Hit when the inbound <Dial> finishes — either answered or timed out.
// If nobody answered (DialCallStatus !== completed), route to voicemail.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export async function POST(request: Request) {
  const formData = await request.formData();
  const dialStatus = formData.get('DialCallStatus')?.toString() || '';
  const callSid = formData.get('CallSid')?.toString() || '';
  const to = formData.get('To')?.toString() || '';

  // If answered, nothing more to do — Twilio handles the rest
  if (dialStatus === 'completed' || dialStatus === 'answered') {
    // Update call_logs to "answered"
    await supabaseAdmin
      .from('call_logs')
      .update({ outcome: 'inbound_answered' })
      .eq('twilio_call_sid', callSid);
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  // Nobody answered — go to voicemail
  const { data: routing } = await supabaseAdmin
    .from('phone_number_routing')
    .select('voicemail_message')
    .eq('twilio_phone_number', to)
    .single();

  const voicemailMsg = routing?.voicemail_message
    || 'Thank you for calling DEBTREX Solutions. Please leave a message and we will return your call.';

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
