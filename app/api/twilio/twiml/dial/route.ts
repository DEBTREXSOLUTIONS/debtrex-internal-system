import { generateDialTwiML } from '@/lib/twilio';

// This endpoint is hit by TWILIO (not the user's browser).
// When the agent picks up the call, Twilio fetches this URL and runs
// the returned TwiML to dial the lead and bridge the calls.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const toNumber = url.searchParams.get('to') || '';

  const twiml = generateDialTwiML(toNumber);
  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

// Also support GET, since Twilio uses GET by default for some flows
export async function GET(request: Request) {
  return POST(request);
}
