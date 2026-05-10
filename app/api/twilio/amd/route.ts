import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Twilio Answering Machine Detection webhook.
// Posts the AnsweredBy field as soon as it determines if a human or machine answered.
// Values: human | machine_start | machine_end_beep | machine_end_silence | machine_end_other | fax | unknown
export async function POST(request: Request) {
  const formData = await request.formData();
  const callSid = formData.get('CallSid')?.toString();
  const answeredBy = formData.get('AnsweredBy')?.toString();

  if (!callSid || !answeredBy) return NextResponse.json({ ok: true });

  // If it's a machine, mark the call as voicemail in our log
  // (the duration/outcome will be finalized when the call actually ends via /status)
  if (answeredBy.startsWith('machine') || answeredBy === 'fax') {
    await supabaseAdmin
      .from('call_logs')
      .update({
        outcome: 'voicemail',
        notes: 'Detected as voicemail (AMD)',
      })
      .eq('twilio_call_sid', callSid);
  }

  return NextResponse.json({ ok: true });
}
