import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Twilio webhook for call status updates.
// Hit by Twilio (NOT the browser). No auth — verify via Twilio's signature in production.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const contactId = url.searchParams.get('contact_id');

  // Twilio sends URL-encoded form data
  const formData = await request.formData();
  const callSid = formData.get('CallSid')?.toString();
  const callStatus = formData.get('CallStatus')?.toString();
  const callDuration = formData.get('CallDuration')?.toString();
  const errorCode = formData.get('ErrorCode')?.toString();
  const errorMessage = formData.get('ErrorMessage')?.toString();
  const from = formData.get('From')?.toString();
  const to = formData.get('To')?.toString();

  // Log every failure with full context — this is where you find out why
  // Twilio is saying "your call could not be completed". The ErrorCode
  // tells you exactly: e.g. 13224 = invalid 'From', 13225 = invalid 'To',
  // 13227 = geo permission denied, 21215 = international not enabled.
  if (callStatus === 'failed' || callStatus === 'canceled' || errorCode) {
    console.error('Twilio call failed:', {
      callSid, callStatus, errorCode, errorMessage, from, to, duration: callDuration,
    });
  }

  if (!callSid) return NextResponse.json({ ok: true }); // Ignore malformed

  // Map Twilio status to our outcome
  let outcome: string | null = null;
  if (callStatus === 'completed' && callDuration && parseInt(callDuration) > 5) {
    outcome = 'connected';
  } else if (callStatus === 'no-answer' || callStatus === 'completed' && (!callDuration || parseInt(callDuration) <= 5)) {
    outcome = 'no_answer';
  } else if (callStatus === 'busy') {
    outcome = 'busy';
  } else if (callStatus === 'failed' || callStatus === 'canceled') {
    outcome = 'no_answer';
  }

  // Update the matching call log
  const updates: any = {};
  if (callDuration) updates.duration_seconds = parseInt(callDuration);
  if (outcome) updates.outcome = outcome;

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin
      .from('call_logs')
      .update(updates)
      .eq('twilio_call_sid', callSid);
  }

  return NextResponse.json({ ok: true });
}
