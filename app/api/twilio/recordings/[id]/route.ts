import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

// Proxy for Twilio recording playback.
// Twilio recording URLs require HTTP Basic Auth — the browser can't access them
// directly without prompting for credentials. This route fetches the recording
// with the server's auth and streams it back to the browser.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'call.log')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!ACCOUNT_SID || !AUTH_TOKEN)
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 });

  const { id } = await params;

  // Look up the call log and get the recording URL
  const { data: callLog } = await supabaseAdmin
    .from('call_logs')
    .select('twilio_recording_url')
    .eq('id', id)
    .single();

  if (!callLog?.twilio_recording_url)
    return NextResponse.json({ error: 'No recording for this call' }, { status: 404 });

  // Fetch from Twilio with auth
  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  const twilioRes = await fetch(callLog.twilio_recording_url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!twilioRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: twilioRes.status });
  }

  // Stream the audio back to the browser
  return new Response(twilioRes.body, {
    headers: {
      'Content-Type': twilioRes.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Length': twilioRes.headers.get('Content-Length') || '',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
