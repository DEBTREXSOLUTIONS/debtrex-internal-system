import { supabaseAdmin } from '@/lib/supabase';

// Twilio hits this URL when a browser-based call is placed.
// The browser passes a "To" parameter — we return TwiML telling Twilio to dial it.
//
// IMPORTANT: This is set as the "Request URL" on your TwiML App in the Twilio console.
// Configuration steps are in the Browser Calling Setup Guide.

export async function POST(request: Request) {
  const formData = await request.formData();
  const to = formData.get('To')?.toString() || '';
  const agentId = formData.get('agentId')?.toString();
  const contactId = formData.get('contactId')?.toString();

  // Determine caller ID:
  //   1. Try the agent's assigned twilio_phone_number
  //   2. Fall back to TWILIO_PHONE_NUMBER env var
  let callerId = process.env.TWILIO_PHONE_NUMBER || '';
  if (agentId) {
    const { data: agent } = await supabaseAdmin
      .from('profiles')
      .select('twilio_phone_number')
      .eq('id', agentId)
      .single();
    if (agent?.twilio_phone_number) callerId = agent.twilio_phone_number;
  }

  const safeTo = to.replace(/[^+\d]/g, '');
  const safeCallerId = callerId.replace(/[^+\d]/g, '');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  // Status callback: fire-and-forget event hook (NOT a TwiML continuation).
  // The previous code used `action=` for this, but `action` makes Twilio
  // expect TwiML back from the URL — and /api/twilio/status returns JSON,
  // causing Twilio error 12300 (Invalid Content-Type) on every call.
  // `statusCallback` is the right attribute: Twilio fires it without
  // expecting a response body.
  // Always fire status updates — webhook matches rows by CallSid, not by contact.
  // Without this, dialer-only calls would never get duration/outcome filled in.
  const statusCallback = appUrl
    ? `${appUrl}/api/twilio/status${contactId ? `?contact_id=${contactId}` : ''}`
    : '';
  const recordingCallback = contactId
    ? `${appUrl}/api/twilio/recording?contact_id=${contactId}`
    : '';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${safeCallerId}" record="record-from-answer-dual" answerOnBridge="true" timeout="30"${statusCallback ? ` statusCallback="${statusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST"` : ''}${recordingCallback ? ` recordingStatusCallback="${recordingCallback}"` : ''}>
    <Number>${safeTo}</Number>
  </Dial>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function GET(request: Request) {
  return POST(request);
}
