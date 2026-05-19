// Twilio fetches this for the outbound leg created during a merge — it
// returns TwiML that immediately drops the dialed party into the named
// conference room.

export async function POST(request: Request) {
  return GET(request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const room = url.searchParams.get('room') || '';

  const safeRoom = room.replace(/[^a-zA-Z0-9_\-]/g, '');
  if (!safeRoom) {
    return new Response('<?xml version="1.0"?><Response><Hangup/></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${safeRoom}</Conference>
  </Dial>
</Response>`;
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
