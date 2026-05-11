import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Twilio hits this when a voicemail recording finishes.
export async function POST(request: Request) {
  const formData = await request.formData();
  const callSid = formData.get('CallSid')?.toString();
  const recordingUrl = formData.get('RecordingUrl')?.toString();
  const recordingDuration = formData.get('RecordingDuration')?.toString();

  if (!callSid || !recordingUrl) return NextResponse.json({ ok: true });

  await supabaseAdmin
    .from('call_logs')
    .update({
      outcome: 'inbound_voicemail',
      twilio_recording_url: recordingUrl + '.mp3',
      twilio_recording_duration: recordingDuration ? parseInt(recordingDuration) : null,
      notes: 'Inbound voicemail',
    })
    .eq('twilio_call_sid', callSid);

  return NextResponse.json({ ok: true });
}
