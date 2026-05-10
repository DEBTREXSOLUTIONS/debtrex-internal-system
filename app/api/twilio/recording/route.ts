import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Twilio webhook called when a recording finishes processing
export async function POST(request: Request) {
  const formData = await request.formData();
  const callSid = formData.get('CallSid')?.toString();
  const recordingUrl = formData.get('RecordingUrl')?.toString();
  const recordingDuration = formData.get('RecordingDuration')?.toString();

  if (!callSid || !recordingUrl) return NextResponse.json({ ok: true });

  // Twilio recording URLs are .json by default — append .mp3 for direct playback
  const playableUrl = recordingUrl + '.mp3';

  await supabaseAdmin
    .from('call_logs')
    .update({
      twilio_recording_url: playableUrl,
      twilio_recording_duration: recordingDuration ? parseInt(recordingDuration) : null,
    })
    .eq('twilio_call_sid', callSid);

  return NextResponse.json({ ok: true });
}
